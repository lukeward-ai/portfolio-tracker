'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import type { Portfolio, Profile, Currency } from '@/lib/types'

export async function addPortfolio(
  name: string,
  broker: string,
): Promise<{ data: Portfolio | null; error: string | null }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('portfolios')
    .insert({ user_id: DEMO_USER_ID, name, description: broker })
    .select()
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Unknown error' }

  await db.from('cash_positions').insert([
    { portfolio_id: data.id, user_id: DEMO_USER_ID, currency: 'USD', amount: 0 },
    { portfolio_id: data.id, user_id: DEMO_USER_ID, currency: 'EUR', amount: 0 },
    { portfolio_id: data.id, user_id: DEMO_USER_ID, currency: 'GBP', amount: 0 },
  ])

  return { data: data as Portfolio, error: null }
}

export async function editPortfolio(
  id: string,
  name: string,
  broker: string,
): Promise<{ data: Portfolio | null; error: string | null }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('portfolios')
    .update({ name, description: broker })
    .eq('id', id)
    .eq('user_id', DEMO_USER_ID)
    .select()
    .single()
  return { data: data as Portfolio | null, error: error?.message ?? null }
}

export async function deletePortfolio(
  id: string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', DEMO_USER_ID)
  return { error: error?.message ?? null }
}

export async function saveProfile(
  fullName: string,
  baseCurrency: Currency,
  taxJurisdiction: string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('profiles')
    .update({ full_name: fullName, base_currency: baseCurrency, tax_jurisdiction: taxJurisdiction })
    .eq('id', DEMO_USER_ID)
  return { error: error?.message ?? null }
}
