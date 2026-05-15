export const dynamic = 'force-dynamic'

import { TransactionsClient } from './transactions-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function TransactionsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: portfolios }, { data: transactions }] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', user.id),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: false }),
  ])

  return (
    <TransactionsClient
      userId={user.id}
      portfolios={portfolios ?? []}
      transactions={transactions ?? []}
    />
  )
}
