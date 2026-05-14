-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  base_currency text not null default 'USD' check (base_currency in ('USD', 'EUR', 'GBP')),
  tax_jurisdiction text not null default 'UK' check (tax_jurisdiction in ('UK', 'US', 'EU', 'OTHER')),
  created_at timestamptz default now()
);

-- Portfolios
create table public.portfolios (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Transactions (buy/sell)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('BUY', 'SELL')),
  ticker text not null,
  name text,
  quantity decimal(18, 8) not null,
  price decimal(18, 4) not null,
  currency text not null check (currency in ('USD', 'EUR', 'GBP')),
  fees decimal(18, 4) default 0,
  notes text,
  executed_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Cash positions
create table public.cash_positions (
  id uuid default uuid_generate_v4() primary key,
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  currency text not null check (currency in ('USD', 'EUR', 'GBP')),
  amount decimal(18, 4) not null default 0,
  updated_at timestamptz default now(),
  unique(portfolio_id, currency)
);

-- Watchlist
create table public.watchlist (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  name text,
  added_at timestamptz default now(),
  unique(user_id, ticker)
);

-- Price cache (reduce API calls)
create table public.price_cache (
  ticker text primary key,
  price decimal(18, 4),
  currency text default 'USD',
  change_percent decimal(8, 4),
  previous_close decimal(18, 4),
  market_cap bigint,
  name text,
  updated_at timestamptz default now()
);

-- Exchange rate cache
create table public.exchange_rate_cache (
  id text primary key,
  base text not null,
  target text not null,
  rate decimal(18, 8) not null,
  updated_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.transactions enable row level security;
alter table public.cash_positions enable row level security;
alter table public.watchlist enable row level security;
alter table public.price_cache enable row level security;
alter table public.exchange_rate_cache enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Portfolios policies
create policy "Users can manage own portfolios" on public.portfolios for all using (auth.uid() = user_id);

-- Transactions policies
create policy "Users can manage own transactions" on public.transactions for all using (auth.uid() = user_id);

-- Cash positions policies
create policy "Users can manage own cash positions" on public.cash_positions for all using (auth.uid() = user_id);

-- Watchlist policies
create policy "Users can manage own watchlist" on public.watchlist for all using (auth.uid() = user_id);

-- Price cache - readable by all authenticated users
create policy "Authenticated users can read price cache" on public.price_cache for select using (auth.role() = 'authenticated');
create policy "Service role can write price cache" on public.price_cache for all using (true);

-- Exchange rate cache - readable by all authenticated users
create policy "Authenticated users can read exchange rates" on public.exchange_rate_cache for select using (auth.role() = 'authenticated');
create policy "Service role can write exchange rates" on public.exchange_rate_cache for all using (true);

-- Trigger: auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: auto-create default portfolio on profile creation
create or replace function public.handle_new_profile()
returns trigger as $$
begin
  insert into public.portfolios (user_id, name, description)
  values (new.id, 'My Portfolio', 'Default portfolio');

  insert into public.cash_positions (portfolio_id, user_id, currency, amount)
  select p.id, new.id, c.currency, 0
  from public.portfolios p
  cross join (values ('USD'), ('EUR'), ('GBP')) as c(currency)
  where p.user_id = new.id
  order by p.created_at
  limit 3;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();
