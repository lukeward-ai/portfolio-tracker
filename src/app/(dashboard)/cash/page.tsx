export const dynamic = 'force-dynamic'

import { CashClient } from './cash-client'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function CashPage() {
  const db = createAdminClient()
  const userId = DEMO_USER_ID

  const [{ data: portfolios }, { data: cashPositions }] = await Promise.all([
    db.from('portfolios').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    db.from('cash_positions').select('*').eq('user_id', userId),
  ])

  return (
    <CashClient
      portfolios={portfolios ?? []}
      cashPositions={cashPositions ?? []}
    />
  )
}
