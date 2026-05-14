import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CashClient } from './cash-client'

export default async function CashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: portfolios }, { data: cashPositions }] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', user.id),
    supabase.from('cash_positions').select('*').eq('user_id', user.id),
  ])

  return (
    <CashClient
      userId={user.id}
      portfolios={portfolios ?? []}
      cashPositions={cashPositions ?? []}
    />
  )
}
