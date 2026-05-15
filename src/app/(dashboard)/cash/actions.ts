'use server'

import { createClient } from '@/lib/supabase/server'
import type { CashPosition } from '@/lib/types'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function adjustCash(
  portfolioId: string,
  currency: string,
  newAmount: number,
): Promise<{ data: CashPosition | null; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { data: null, error: 'Not authenticated' }
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('cash_positions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('currency', currency)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('cash_positions')
      .update({ amount: newAmount, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  }

  const { data, error } = await supabase
    .from('cash_positions')
    .insert({ portfolio_id: portfolioId, user_id: user.id, currency, amount: newAmount })
    .select()
    .single()
  return { data, error: error?.message ?? null }
}
