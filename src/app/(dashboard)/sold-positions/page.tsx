export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import { SoldPositionsClient } from './sold-positions-client'

export default async function SoldPositionsPage() {
  const db = createAdminClient()

  const [
    { data: profile },
    { data: transactions },
    { data: portfolios },
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', DEMO_USER_ID).single(),
    db.from('transactions').select('*').eq('user_id', DEMO_USER_ID).order('executed_at', { ascending: true }),
    db.from('portfolios').select('*').eq('user_id', DEMO_USER_ID),
  ])

  return (
    <SoldPositionsClient
      profile={profile}
      transactions={transactions ?? []}
      portfolios={portfolios ?? []}
    />
  )
}
