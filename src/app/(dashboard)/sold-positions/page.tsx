export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { SoldPositionsClient } from './sold-positions-client'

export default async function SoldPositionsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [
    { data: profile },
    { data: transactions },
    { data: portfolios },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: true }),
    supabase.from('portfolios').select('*').eq('user_id', user.id),
  ])

  return (
    <SoldPositionsClient
      profile={profile}
      transactions={transactions ?? []}
      portfolios={portfolios ?? []}
    />
  )
}
