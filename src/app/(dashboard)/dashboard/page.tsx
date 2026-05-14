import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: portfolios }, { data: transactions }, { data: cashPositions }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('portfolios').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: false }),
      supabase.from('cash_positions').select('*').eq('user_id', user.id),
    ])

  return (
    <DashboardClient
      profile={profile}
      portfolios={portfolios ?? []}
      transactions={transactions ?? []}
      cashPositions={cashPositions ?? []}
    />
  )
}
