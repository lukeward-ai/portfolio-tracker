export const dynamic = 'force-dynamic'

import { PnLClient } from './pnl-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fetchAllTransactions } from '@/lib/fetch-transactions'

export default async function PnLPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, transactions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    fetchAllTransactions(supabase, user.id),
  ])

  return <PnLClient profile={profile} transactions={transactions} />
}
