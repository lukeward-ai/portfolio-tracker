import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PnLClient } from './pnl-client'

export default async function PnLPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: transactions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: true }),
  ])

  return <PnLClient profile={profile} transactions={transactions ?? []} />
}
