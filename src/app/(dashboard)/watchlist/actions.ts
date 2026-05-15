'use server'

import { createClient } from '@/lib/supabase/server'
import type { WatchlistItem } from '@/lib/types'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function addWatchlistItem(
  ticker: string,
  name: string,
): Promise<{ data: WatchlistItem | null; error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { data: null, error: 'Not authenticated' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('watchlist')
    .insert({ user_id: user.id, ticker, name })
    .select()
    .single()
  return { data: data as WatchlistItem | null, error: error?.message ?? null }
}

export async function removeWatchlistItem(
  id: string,
): Promise<{ error: string | null }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  return { error: error?.message ?? null }
}
