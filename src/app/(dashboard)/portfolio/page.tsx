export const dynamic = 'force-dynamic'

import { PortfolioClient } from './portfolio-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fetchAllTransactions } from '@/lib/fetch-transactions'

export default async function PortfolioPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, { data: portfolios }, transactions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    fetchAllTransactions(supabase, user.id),
  ])

  return <PortfolioClient profile={profile} portfolios={portfolios ?? []} transactions={transactions} />
}
