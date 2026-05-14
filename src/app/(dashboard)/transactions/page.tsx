import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

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
