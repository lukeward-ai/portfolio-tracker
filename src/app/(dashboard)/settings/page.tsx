export const dynamic = 'force-dynamic'

import { SettingsClient } from './settings-client'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function SettingsPage() {
  const db = createAdminClient()
  const userId = DEMO_USER_ID

  const [{ data: profile }, { data: portfolios }, { data: transactions }, { data: cashPositions }] =
    await Promise.all([
      db.from('profiles').select('*').eq('id', userId).single(),
      db.from('portfolios').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      db.from('transactions').select('portfolio_id').eq('user_id', userId),
      db.from('cash_positions').select('*').eq('user_id', userId),
    ])

  const txCountByPortfolio = (transactions ?? []).reduce((acc, t) => {
    acc[t.portfolio_id] = (acc[t.portfolio_id] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <SettingsClient
      userId={userId}
      profile={profile}
      portfolios={portfolios ?? []}
      txCountByPortfolio={txCountByPortfolio}
      cashPositions={cashPositions ?? []}
    />
  )
}
