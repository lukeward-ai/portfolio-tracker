export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import { AiAnalysisClient } from './ai-analysis-client'

export default async function AiAnalysisPage() {
  const db = createAdminClient()

  const [
    { data: profile },
    { data: transactions },
    { data: snapshots },
    { data: rateRows },
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', DEMO_USER_ID).single(),
    db.from('transactions').select('*').eq('user_id', DEMO_USER_ID).order('executed_at', { ascending: true }),
    db.from('portfolio_snapshots').select('*').eq('user_id', DEMO_USER_ID)
      .order('snapshot_date', { ascending: true }).limit(10000),
    db.from('exchange_rate_cache').select('base, target, rate'),
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
