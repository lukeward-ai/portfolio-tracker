'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import type { CashPosition } from '@/lib/types'

export async function adjustCash(
  portfolioId: string,
  currency: string,
  newAmount: number,
): Promise<{ data: CashPosition | null; error: string | null }> {
  const db = createAdminClient()

  const { data: existing } = await db
    .from('cash_positions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('currency', currency)
    .maybeSingle()

  if (existing) {
    const { data, error } = await db
      .from('cash_positions')
      .update({ amount: newAmount, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  }

  const { data, error } = await db
    .from('cash_positions')
    .insert({ portfolio_id: portfolioId, user_id: DEMO_USER_ID, currency, amount: newAmount })
    .select()
    .single()
  return { data, error: error?.message ?? null }
}
