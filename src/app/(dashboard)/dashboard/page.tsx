export const dynamic = 'force-dynamic'

import { DashboardClient } from './dashboard-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fetchAllTransactions } from '@/lib/fetch-transactions'

export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, { data: portfolios }, transactions, { data: cashPositions }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('portfolios').select('*').eq('user_id', user.id),
      fetchAllTransactions(supabase, user.id),
      supabase.from('cash_positions').select('*').eq('user_id', user.id),
    ])

  return (
    <DashboardClient
      profile={profile}
      portfolios={portfolios ?? []}
      transactions={[...transactions].reverse()}
      cashPositions={cashPositions ?? []}
    />
  )
}
