export const dynamic = 'force-dynamic'

import { PortfolioClient } from './portfolio-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function PortfolioPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, { data: portfolios }, { data: transactions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: true }),
  ])

  return <PortfolioClient profile={profile} portfolios={portfolios ?? []} transactions={transactions ?? []} />
}
