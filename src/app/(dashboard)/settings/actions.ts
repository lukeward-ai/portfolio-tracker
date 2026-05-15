'use server'

import { createClient } from '@/lib/supabase/server'
import type { Portfolio, ImportBatch, Currency } from '@/lib/types'
import type { ParsedRow, BrokerFormat } from '@/lib/csv-import'

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
  fileName: string,
  brokerFormat: BrokerFormat,
): Promise<{ imported: number; importBatchId: string | null; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { imported: 0, importBatchId: null, error: 'Not authenticated' }
  const supabase = await createClient()

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', portfolioId)
    .eq('user_id', user.id)
    .single()

  if (!portfolio) return { imported: 0, importBatchId: null, error: 'Portfolio not found' }

  const validRows = rows.filter((r) => r.valid)
  if (validRows.length === 0) return { imported: 0, importBatchId: null, error: null }

  // Create the import batch record first
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      user_id: user.id,
      portfolio_id: portfolioId,
      file_name: fileName,
      broker_format: brokerFormat,
      trade_count: validRows.length,
    })
    .select()
    .single()

  if (batchError || !batch) return { imported: 0, importBatchId: null, error: batchError?.message ?? 'Failed to create import record' }

  const transactions = validRows.map((r) => ({
    portfolio_id: portfolioId,
    user_id: user.id,
    import_id: batch.id,
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
    const chunk = transactions.slice(i, i + 500)
    const { error } = await supabase.from('transactions').insert(chunk)
    if (error) return { imported, importBatchId: batch.id, error: error.message }
    imported += chunk.length
  }

  return { imported, importBatchId: batch.id, error: null }
}

export async function deleteImport(
  importBatchId: string,
): Promise<{ error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const supabase = await createClient()

  // Deleting the batch cascades to transactions via ON DELETE CASCADE
  const { error } = await supabase
    .from('import_batches')
    .delete()
    .eq('id', importBatchId)
    .eq('user_id', user.id)

  return { error: error?.message ?? null }
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
