export const dynamic = 'force-dynamic'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AiAnalysisClient } from './ai-analysis-client'

export default async function AiAnalysisPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [
    { data: profile },
    { data: transactions },
    { data: snapshots },
    { data: rateRows },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: true }),
    supabase.from('portfolio_snapshots').select('*').eq('user_id', user.id)
      .order('snapshot_date', { ascending: true }).limit(10000),
    supabase.from('exchange_rate_cache').select('base, target, rate'),
  ])

  const rates: Record<string, number> = {}
  for (const r of rateRows ?? []) rates[`${r.base}_${r.target}`] = r.rate

  return (
    <AiAnalysisClient
      profile={profile}
      transactions={transactions ?? []}
      snapshots={snapshots ?? []}
      rates={rates}
    />
  )
}
