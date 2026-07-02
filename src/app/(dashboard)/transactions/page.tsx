export const dynamic = 'force-dynamic'

import { TransactionsClient } from './transactions-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fetchAllTransactions } from '@/lib/fetch-transactions'

export default async function TransactionsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: portfolios }, transactions] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', user.id),
    fetchAllTransactions(supabase, user.id),
  ])

  return (
    <TransactionsClient
      userId={user.id}
      portfolios={portfolios ?? []}
      transactions={[...transactions].reverse()}
    />
  )
}
