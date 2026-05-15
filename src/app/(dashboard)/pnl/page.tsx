export const dynamic = 'force-dynamic'

import { PnLClient } from './pnl-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function PnLPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, { data: transactions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: true }),
  ])

  return <PnLClient profile={profile} transactions={transactions ?? []} />
}
