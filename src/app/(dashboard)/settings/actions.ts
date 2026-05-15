'use server'

import { createClient } from '@/lib/supabase/server'
import type { Portfolio, Currency } from '@/lib/types'
import type { ParsedRow } from '@/lib/csv-import'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function addPortfolio(
  name: string,
  broker: string,
): Promise<{ data: Portfolio | null; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { data: null, error: 'Not authenticated' }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('portfolios')
    .insert({ user_id: user.id, name, description: broker })
    .select()
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Unknown error' }

  await supabase.from('cash_positions').insert([
    { portfolio_id: data.id, user_id: user.id, currency: 'USD', amount: 0 },
    { portfolio_id: data.id, user_id: user.id, currency: 'EUR', amount: 0 },
    { portfolio_id: data.id, user_id: user.id, currency: 'GBP', amount: 0 },
  ])

  return { data: data as Portfolio, error: null }
}

export async function editPortfolio(
  id: string,
  name: string,
  broker: string,
): Promise<{ data: Portfolio | null; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { data: null, error: 'Not authenticated' }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('portfolios')
    .update({ name, description: broker })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  return { data: data as Portfolio | null, error: error?.message ?? null }
}

export async function deletePortfolio(
  id: string,
): Promise<{ error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const supabase = await createClient()

  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  return { error: error?.message ?? null }
}

export async function importTransactionsToPortfolio(
  portfolioId: string,
  rows: ParsedRow[],
): Promise<{ imported: number; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { imported: 0, error: 'Not authenticated' }
  const supabase = await createClient()

  // Verify portfolio belongs to user
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', portfolioId)
    .eq('user_id', user.id)
    .single()

  if (!portfolio) return { imported: 0, error: 'Portfolio not found' }

  const validRows = rows.filter((r) => r.valid)
  if (validRows.length === 0) return { imported: 0, error: null }

  const transactions = validRows.map((r) => ({
    portfolio_id: portfolioId,
    user_id: user.id,
    type: r.type,
    ticker: r.ticker,
    name: r.name,
    quantity: r.quantity,
    price: r.price,
    currency: (r.currency as Currency) || 'USD',
    fees: r.fees,
    notes: null,
    executed_at: r.date,
  }))

  let imported = 0
  for (let i = 0; i < transactions.length; i += 500) {
    const batch = transactions.slice(i, i + 500)
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) return { imported, error: error.message }
    imported += batch.length
  }

  return { imported, error: null }
}

export async function saveProfile(
  fullName: string,
  baseCurrency: Currency,
  taxJurisdiction: string,
): Promise<{ error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, base_currency: baseCurrency, tax_jurisdiction: taxJurisdiction })
    .eq('id', user.id)
  return { error: error?.message ?? null }
}
