// Seed script - loads Trading 212 data into Supabase
// Run: node scripts/seed.mjs

const SUPABASE_URL = 'https://ixetlplonomgwpjjdiff.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZXRscGxvbm9tZ3dwampkaWZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc3NDMxOSwiZXhwIjoyMDk0MzUwMzE5fQ.C7ncxl_gqjPy4QJ0ukReUibymoRmK-AYBYj2lsB4S3o'

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
}

async function supabase(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...headers, 'Prefer': method === 'POST' ? 'return=representation' : '' },
    body: body ? JSON.stringify(body) : null,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function adminApi(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`auth ${method} ${path} → ${res.status}: ${text}`)
  return JSON.parse(text)
}

// ISA transactions — from_2023-10-21_to_2024-10-20 + from_2024-10-21_to_2025-10-20
const ISA_TRANSACTIONS = [
  // 2023-2024 period (PLTR, TSLA, COIN, PYPL, MSFT, SHOP, CRWD)
  { type:'BUY', ticker:'PLTR', name:'Palantir', qty:150,   price:19.90,  fee:3.60,  at:'2023-11-15T14:30:07Z', fx:1.24370854 },
  { type:'BUY', ticker:'PLTR', name:'Palantir', qty:25,    price:18.27,  fee:0.54,  at:'2023-12-05T14:30:06Z', fx:1.26198436 },
  { type:'BUY', ticker:'PLTR', name:'Palantir', qty:25,    price:17.18,  fee:0.51,  at:'2023-12-07T17:49:20Z', fx:1.26026995 },
  { type:'BUY', ticker:'PLTR', name:'Palantir', qty:50,    price:17.87,  fee:1.07,  at:'2023-12-11T19:56:25Z', fx:1.25539179 },
  { type:'BUY', ticker:'PLTR', name:'Palantir', qty:100,   price:16.60,  fee:1.97,  at:'2024-01-19T14:30:09Z', fx:1.26709819 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',    qty:20,    price:197.10, fee:4.70,  at:'2024-02-20T09:00:06Z', fx:1.25874125 },
  { type:'BUY', ticker:'COIN', name:'Coinbase', qty:20,    price:167.49, fee:3.96,  at:'2024-02-23T17:57:38Z', fx:1.26761043 },
  { type:'SELL',ticker:'COIN', name:'Coinbase', qty:20,    price:207.79, fee:4.93,  at:'2024-02-28T12:43:53Z', fx:1.26452170 },
  { type:'BUY', ticker:'PYPL', name:'PayPal',   qty:50,    price:60.49,  fee:3.58,  at:'2024-03-01T17:47:09Z', fx:1.26560826 },
  { type:'BUY', ticker:'MSFT', name:'Microsoft',qty:3,     price:415.42, fee:1.48,  at:'2024-03-04T09:00:01Z', fx:1.26692352 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',    qty:10,    price:177.45, fee:2.09,  at:'2024-03-06T13:48:12Z', fx:1.27226189 },
  { type:'BUY', ticker:'PYPL', name:'PayPal',   qty:25,    price:58.59,  fee:1.73,  at:'2024-03-06T13:50:30Z', fx:1.27230165 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',    qty:10,    price:162.79, fee:1.91,  at:'2024-03-14T20:02:26Z', fx:1.27566373 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',    qty:10,    price:160.90, fee:1.94,  at:'2024-04-15T20:10:47Z', fx:1.24473944 },
  { type:'BUY', ticker:'MSFT', name:'Microsoft',qty:3,     price:413.39, fee:1.49,  at:'2024-04-15T20:11:22Z', fx:1.24472569 },
  { type:'BUY', ticker:'PYPL', name:'PayPal',   qty:25,    price:63.50,  fee:1.91,  at:'2024-04-15T20:13:06Z', fx:1.24466850 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',    qty:12,    price:141.86, fee:2.07,  at:'2024-04-22T16:03:29Z', fx:1.23391393 },
  { type:'BUY', ticker:'SHOP', name:'Shopify',  qty:30,    price:62.49,  fee:2.25,  at:'2024-05-08T19:29:37Z', fx:1.24940019 },
  { type:'BUY', ticker:'SHOP', name:'Shopify',  qty:30,    price:57.41,  fee:2.03,  at:'2024-05-21T18:52:35Z', fx:1.27102320 },
  { type:'BUY', ticker:'SHOP', name:'Shopify',  qty:40,    price:66.55,  fee:3.14,  at:'2024-06-17T20:38:16Z', fx:1.27048065 },
  { type:'BUY', ticker:'CRWD', name:'CrowdStrike',qty:10,  price:312.36, fee:3.63,  at:'2024-07-19T16:07:50Z', fx:1.29213204 },
  { type:'BUY', ticker:'CRWD', name:'CrowdStrike',qty:5,   price:298.88, fee:1.74,  at:'2024-07-19T18:58:04Z', fx:1.29092448 },
  { type:'BUY', ticker:'CRWD', name:'CrowdStrike',qty:5,   price:274.91, fee:1.60,  at:'2024-07-23T17:17:09Z', fx:1.29087545 },
  { type:'BUY', ticker:'CRWD', name:'CrowdStrike',qty:10,  price:263.12, fee:3.05,  at:'2024-07-24T17:12:27Z', fx:1.29256011 },
  { type:'BUY', ticker:'CRWD', name:'CrowdStrike',qty:5,   price:230.79, fee:1.35,  at:'2024-07-30T17:53:57Z', fx:1.28364999 },
  { type:'BUY', ticker:'SHOP', name:'Shopify',  qty:10,    price:59.56,  fee:0.70,  at:'2024-07-30T17:54:32Z', fx:1.28362068 },
  // 2024-2025 period (AMD, MSFT sell, TSLA, META, AMZN)
  { type:'BUY', ticker:'AMD',  name:'AMD',      qty:40,    price:139.77, fee:6.67,  at:'2024-11-25T10:28:09Z', fx:1.25786899 },
  { type:'BUY', ticker:'AMD',  name:'AMD',      qty:20,    price:143.35, fee:3.40,  at:'2024-12-03T14:27:17Z', fx:1.26640988 },
  { type:'BUY', ticker:'AMD',  name:'AMD',      qty:5,     price:119.29, fee:0.72,  at:'2024-12-19T19:58:35Z', fx:1.25028822 },
  { type:'SELL',ticker:'MSFT', name:'Microsoft',qty:6,     price:439.33, fee:3.16,  at:'2024-12-19T19:59:13Z', fx:1.25048862 },
  { type:'BUY', ticker:'AMD',  name:'AMD',      qty:15,    price:119.23, fee:2.15,  at:'2024-12-19T19:59:47Z', fx:1.25034082 },
  { type:'BUY', ticker:'AMD',  name:'AMD',      qty:10,    price:114.54, fee:1.38,  at:'2025-01-28T19:32:16Z', fx:1.24298690 },
  { type:'BUY', ticker:'AMD',  name:'AMD',      qty:50,    price:82.57,  fee:4.87,  at:'2025-04-07T16:31:40Z', fx:1.27182997 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',    qty:20,    price:229.75, fee:5.42,  at:'2025-04-07T16:32:05Z', fx:1.27179981 },
  { type:'BUY', ticker:'META', name:'Meta',     qty:5,     price:513.15, fee:3.03,  at:'2025-04-07T16:32:59Z', fx:1.27184807 },
  { type:'BUY', ticker:'AMZN', name:'Amazon',   qty:15,    price:173.10, fee:3.06,  at:'2025-04-07T16:33:22Z', fx:1.27223907 },
]

// Invest (taxable) transactions
const INVEST_TRANSACTIONS = [
  { type:'BUY', ticker:'AMD',  name:'AMD',  qty:20,  price:109.26, fee:2.61, at:'2025-02-05T11:33:41Z', fx:1.25408904 },
  { type:'BUY', ticker:'AMD',  name:'AMD',  qty:40,  price:108.68, fee:5.20, at:'2025-02-05T11:48:12Z', fx:1.25336969 },
  { type:'BUY', ticker:'PYPL', name:'PayPal',qty:50, price:78.55,  fee:4.70, at:'2025-02-05T11:49:54Z', fx:1.25327878 },
  { type:'BUY', ticker:'AMD',  name:'AMD',  qty:40,  price:98.07,  fee:4.55, at:'2025-03-13T15:55:50Z', fx:1.29417936 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',qty:18,  price:234.88, fee:4.90, at:'2025-03-13T15:59:02Z', fx:1.29444939 },
  { type:'BUY', ticker:'PYPL', name:'PayPal',qty:50, price:69.09,  fee:3.99, at:'2025-03-18T17:55:22Z', fx:1.30000865 },
  { type:'BUY', ticker:'PYPL', name:'PayPal',qty:50, price:58.38,  fee:3.44, at:'2025-04-07T16:35:00Z', fx:1.27237221 },
  { type:'BUY', ticker:'AMD',  name:'AMD',  qty:20,  price:77.69,  fee:1.83, at:'2025-04-08T20:31:02Z', fx:1.27568739 },
  { type:'BUY', ticker:'TSLA', name:'Tesla',qty:8,   price:413.19, fee:3.64, at:'2026-02-06T19:22:37Z', fx:1.36155138 },
  { type:'BUY', ticker:'META', name:'Meta', qty:12,  price:524.47, fee:7.11, at:'2026-03-27T19:00:39Z', fx:1.32687916 },
]

async function main() {
  console.log('🌱 Seeding Supabase...\n')

  // 1. Check for existing demo user
  console.log('1. Checking for existing user...')
  let userId
  try {
    const users = await adminApi('users?email=demo@stocktracker.app')
    if (users?.users?.length > 0) {
      userId = users.users[0].id
      console.log(`   Found existing user: ${userId}`)
    }
  } catch (e) {
    console.log('   (could not list users, will try to create)')
  }

  if (!userId) {
    console.log('   Creating demo user...')
    const user = await adminApi('users', 'POST', {
      email: 'demo@stocktracker.app',
      password: 'Demo1234!',
      email_confirm: true,
      user_metadata: { full_name: 'Luke Ward' },
    })
    userId = user.id
    console.log(`   Created user: ${userId}`)
    // Wait for trigger to create profile
    await new Promise(r => setTimeout(r, 1000))
  }

  // 2. Update profile to GBP/UK
  console.log('2. Updating profile...')
  await supabase(`profiles?id=eq.${userId}`, 'PATCH', {
    base_currency: 'GBP',
    tax_jurisdiction: 'UK',
    full_name: 'Luke Ward',
  })
  console.log('   Profile updated')

  // 3. Delete default portfolio (trigger creates "My Portfolio")
  console.log('3. Removing default portfolio...')
  await supabase(`portfolios?user_id=eq.${userId}`, 'DELETE')
  console.log('   Default portfolio removed')

  // 4. Create ISA portfolio
  console.log('4. Creating ISA portfolio...')
  const [isaPortfolio] = await supabase('portfolios', 'POST', {
    user_id: userId,
    name: 'Stocks & Shares ISA',
    description: 'Tax-free UK ISA account via Trading 212',
  })
  console.log(`   ISA portfolio: ${isaPortfolio.id}`)

  // 5. Create Invest portfolio
  console.log('5. Creating Invest portfolio...')
  const [investPortfolio] = await supabase('portfolios', 'POST', {
    user_id: userId,
    name: 'Invest',
    description: 'Taxable trading account via Trading 212',
  })
  console.log(`   Invest portfolio: ${investPortfolio.id}`)

  // 6. Create cash positions for each portfolio
  console.log('6. Creating cash positions...')
  const currencies = ['USD', 'EUR', 'GBP']
  for (const pId of [isaPortfolio.id, investPortfolio.id]) {
    for (const currency of currencies) {
      await supabase('cash_positions', 'POST', {
        portfolio_id: pId,
        user_id: userId,
        currency,
        amount: 0,
      })
    }
  }
  console.log('   Cash positions created')

  // 7. Insert ISA transactions
  console.log(`7. Inserting ${ISA_TRANSACTIONS.length} ISA transactions...`)
  const isaRows = ISA_TRANSACTIONS.map(t => ({
    portfolio_id: isaPortfolio.id,
    user_id: userId,
    type: t.type,
    ticker: t.ticker,
    name: t.name,
    quantity: t.qty,
    price: t.price,
    currency: 'USD',
    fees: t.fee,
    notes: `FX: ${t.fx}`,
    executed_at: t.at,
  }))
  await supabase('transactions', 'POST', isaRows)
  console.log('   ISA transactions inserted')

  // 8. Insert Invest transactions
  console.log(`8. Inserting ${INVEST_TRANSACTIONS.length} Invest transactions...`)
  const investRows = INVEST_TRANSACTIONS.map(t => ({
    portfolio_id: investPortfolio.id,
    user_id: userId,
    type: t.type,
    ticker: t.ticker,
    name: t.name,
    quantity: t.qty,
    price: t.price,
    currency: 'USD',
    fees: t.fee,
    notes: `FX: ${t.fx}`,
    executed_at: t.at,
  }))
  await supabase('transactions', 'POST', investRows)
  console.log('   Invest transactions inserted')

  // 9. Add watchlist
  console.log('9. Creating watchlist...')
  const watchlistItems = [
    { ticker: 'NVDA', name: 'NVIDIA' },
    { ticker: 'AAPL', name: 'Apple' },
    { ticker: 'GOOGL', name: 'Alphabet' },
  ]
  for (const item of watchlistItems) {
    try {
      await supabase('watchlist', 'POST', { user_id: userId, ...item })
    } catch (e) {
      // ignore duplicates
    }
  }
  console.log('   Watchlist created')

  console.log('\n✅ Seed complete!')
  console.log(`   User ID: ${userId}`)
  console.log(`   ISA portfolio: ${isaPortfolio.id}`)
  console.log(`   Invest portfolio: ${investPortfolio.id}`)
  console.log('\n   Copy these IDs into src/lib/demo-user.ts')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
