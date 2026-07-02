import type { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction } from './types'

/**
 * Fetches ALL of a user's transactions, paginating past Supabase's 1000-row
 * max_rows cap. Always returns ascending by executed_at (with a stable id
 * tiebreak) so FIFO calculations are deterministic regardless of caller.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllTransactions(supabase: SupabaseClient<any>, userId: string): Promise<Transaction[]> {
  const PAGE = 1000
  const all: Transaction[] = []
  let start = 0

  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('executed_at', { ascending: true })
      .order('id', { ascending: true })
      .range(start, start + PAGE - 1)

    if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...(data as Transaction[]))
    if (data.length < PAGE) break
    start += PAGE
  }

  return all
}
