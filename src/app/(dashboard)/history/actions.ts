'use server'

import { createClient } from '@/lib/supabase/server'
import { saveSnapshotForUser } from '@/lib/snapshot'
import type { PortfolioSnapshot } from '@/lib/types'

export async function savePortfolioSnapshot(): Promise<{ data: PortfolioSnapshot | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  const { error } = await saveSnapshotForUser(supabase, user.id)
  if (error) return { data: null, error }

  const { data } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .eq('snapshot_date', new Date().toISOString().slice(0, 10))
    .single()

  return { data: data as PortfolioSnapshot | null, error: null }
}

export async function getPortfolioSnapshots(
  range: '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL' = '1Y'
): Promise<PortfolioSnapshot[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let fromDate: string | null = null
  const now = new Date()

  if (range === '7D') fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  else if (range === '1M') fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10)
  else if (range === '3M') fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10)
  else if (range === '6M') fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10)
  else if (range === '1Y') fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)

  // Paginate in chunks of 1000 to bypass Supabase's anon-key max_rows cap
  const PAGE = 1000
  const results: PortfolioSnapshot[] = []
  let start = 0

  while (true) {
    let query = supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: true })
      .range(start, start + PAGE - 1)

    if (fromDate) query = query.gte('snapshot_date', fromDate)

    const { data } = await query
    if (!data || data.length === 0) break
    results.push(...(data as PortfolioSnapshot[]))
    if (data.length < PAGE) break
    start += PAGE
  }

  return results
}
