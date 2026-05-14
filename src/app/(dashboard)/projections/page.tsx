export const dynamic = 'force-dynamic'

import { ProjectionsClient } from './projections-client'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function ProjectionsPage() {
  const db = createAdminClient()
  const userId = DEMO_USER_ID

  const [{ data: profile }, { data: transactions }, { data: cashPositions }] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    db.from('transactions').select('*').eq('user_id', userId).order('executed_at', { ascending: false }),
    db.from('cash_positions').select('*').eq('user_id', userId),
  ])

  return (
    <ProjectionsClient
      profile={profile}
      transactions={transactions ?? []}
      cashPositions={cashPositions ?? []}
    />
  )
}
