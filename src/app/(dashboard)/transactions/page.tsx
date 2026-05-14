export const dynamic = 'force-dynamic'

import { TransactionsClient } from './transactions-client'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function TransactionsPage() {
  const db = createAdminClient()
  const userId = DEMO_USER_ID

  const [{ data: portfolios }, { data: transactions }] = await Promise.all([
    db.from('portfolios').select('*').eq('user_id', userId),
    db.from('transactions').select('*').eq('user_id', userId).order('executed_at', { ascending: false }),
  ])

  return (
    <TransactionsClient
      userId={userId}
      portfolios={portfolios ?? []}
      transactions={transactions ?? []}
    />
  )
}
