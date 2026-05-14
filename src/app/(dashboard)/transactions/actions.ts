'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import type { Transaction, Currency } from '@/lib/types'

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
  const db = createAdminClient()
  const { data, error } = await db
    .from('transactions')
    .insert({ ...payload, user_id: DEMO_USER_ID })
    .select()
    .single()
  return { data: data as Transaction | null, error: error?.message ?? null }
}

export async function deleteTransaction(
  id: string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', DEMO_USER_ID)
  return { error: error?.message ?? null }
}
