'use server'

import { createClient } from '@/lib/supabase/server'
import type { Portfolio, Currency } from '@/lib/types'

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
