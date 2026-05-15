export const dynamic = 'force-dynamic'

import { ProjectionsClient } from './projections-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectionsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, { data: transactions }, { data: cashPositions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: false }),
    supabase.from('cash_positions').select('*').eq('user_id', user.id),
  ])

  return (
    <ProjectionsClient
      profile={profile}
      transactions={transactions ?? []}
      cashPositions={cashPositions ?? []}
    />
  )
}
