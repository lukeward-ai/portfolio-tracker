export const dynamic = 'force-dynamic'

import { CashClient } from './cash-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function CashPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: portfolios }, { data: cashPositions }] = await Promise.all([
    supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase.from('cash_positions').select('*').eq('user_id', user.id),
  ])

  return (
    <CashClient
      portfolios={portfolios ?? []}
      cashPositions={cashPositions ?? []}
    />
  )
}
