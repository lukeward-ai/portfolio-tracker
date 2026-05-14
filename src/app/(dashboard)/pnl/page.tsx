export const dynamic = 'force-dynamic'

import { PnLClient } from './pnl-client'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function PnLPage() {
  const db = createAdminClient()
  const userId = DEMO_USER_ID

  const [{ data: profile }, { data: transactions }] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    db.from('transactions').select('*').eq('user_id', userId).order('executed_at', { ascending: true }),
  ])

  return <PnLClient profile={profile} transactions={transactions ?? []} />
}
