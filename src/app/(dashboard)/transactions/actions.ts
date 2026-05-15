'use server'

import { createClient } from '@/lib/supabase/server'
import type { Transaction, Currency } from '@/lib/types'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function addTransaction(payload: {
  portfolio_id: string
  type: 'BUY' | 'SELL'
  ticker: string
  name: string
  quantity: number
  price: number
  currency: Currency
  fees: number
  notes: string | null
  executed_at: string
}): Promise<{ data: Transaction | null; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { data: null, error: 'Not authenticated' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: user.id })
    .select()
    .single()
  return { data: data as Transaction | null, error: error?.message ?? null }
}

export async function deleteTransaction(
  id: string,
): Promise<{ error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  return { error: error?.message ?? null }
}
