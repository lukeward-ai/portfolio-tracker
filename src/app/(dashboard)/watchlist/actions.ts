'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import type { WatchlistItem } from '@/lib/types'

export async function addWatchlistItem(
  ticker: string,
  name: string,
): Promise<{ data: WatchlistItem | null; error: string | null }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('watchlist')
    .insert({ user_id: DEMO_USER_ID, ticker, name })
    .select()
    .single()
  return { data: data as WatchlistItem | null, error: error?.message ?? null }
}

export async function removeWatchlistItem(
  id: string,
): Promise<{ error: string | null }> {
  const db = createAdminClient()
  const { error } = await db
    .from('watchlist')
    .delete()
    .eq('id', id)
    .eq('user_id', DEMO_USER_ID)
  return { error: error?.message ?? null }
}
