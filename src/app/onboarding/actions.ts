'use server'

import { createClient } from '@/lib/supabase/server'
import type { ParsedRow } from '@/lib/csv-import'
import type { Currency } from '@/lib/types'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function bulkImportTransactions(payload: {
  brokerName: string
  rows: ParsedRow[]
}): Promise<{ portfolioId: string | null; imported: number; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { portfolioId: null, imported: 0, error: 'Not authenticated' }

  const supabase = await createClient()

  // Create portfolio named after the broker
  const { data: portfolio, error: portfolioError } = await supabase
    .from('portfolios')
    .insert({ user_id: user.id, name: payload.brokerName, description: null })
    .select()
    .single()

  if (portfolioError || !portfolio) {
    return { portfolioId: null, imported: 0, error: portfolioError?.message ?? 'Failed to create portfolio' }
  }

  const validRows = payload.rows.filter((r) => r.valid)
  if (validRows.length === 0) {
    return { portfolioId: portfolio.id, imported: 0, error: null }
  }

  const transactions = validRows.map((r) => ({
    portfolio_id: portfolio.id,
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

  // Insert in batches of 500 to avoid payload limits
  let imported = 0
  for (let i = 0; i < transactions.length; i += 500) {
    const batch = transactions.slice(i, i + 500)
    const { error: insertError } = await supabase.from('transactions').insert(batch)
    if (insertError) {
      return { portfolioId: portfolio.id, imported, error: insertError.message }
    }
    imported += batch.length
  }

  return { portfolioId: portfolio.id, imported, error: null }
}
