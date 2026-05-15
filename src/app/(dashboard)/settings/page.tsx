export const dynamic = 'force-dynamic'

import { SettingsClient } from './settings-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, { data: portfolios }, { data: transactions }, { data: cashPositions }, { data: importBatches }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('transactions').select('portfolio_id').eq('user_id', user.id),
      supabase.from('cash_positions').select('*').eq('user_id', user.id),
      supabase.from('import_batches').select('*').eq('user_id', user.id).order('imported_at', { ascending: false }),
    ])

  const txCountByPortfolio = (transactions ?? []).reduce((acc, t) => {
    acc[t.portfolio_id] = (acc[t.portfolio_id] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <SettingsClient
      userId={user.id}
      profile={profile}
      portfolios={portfolios ?? []}
      txCountByPortfolio={txCountByPortfolio}
      cashPositions={cashPositions ?? []}
      importBatches={importBatches ?? []}
    />
  )
}
