export const dynamic = 'force-dynamic'

import { ProjectionsClient } from './projections-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fetchAllTransactions } from '@/lib/fetch-transactions'

export default async function ProjectionsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, transactions, { data: cashPositions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    fetchAllTransactions(supabase, user.id),
    supabase.from('cash_positions').select('*').eq('user_id', user.id),
  ])

  return (
    <ProjectionsClient
      profile={profile}
      transactions={[...transactions].reverse()}
      cashPositions={cashPositions ?? []}
    />
  )
}
