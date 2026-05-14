export const dynamic = 'force-dynamic'

import { PortfolioClient } from './portfolio-client'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function PortfolioPage() {
  const db = createAdminClient()
  const userId = DEMO_USER_ID

  const [{ data: profile }, { data: portfolios }, { data: transactions }] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    db.from('portfolios').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    db.from('transactions').select('*').eq('user_id', userId).order('executed_at', { ascending: true }),
  ])

  return <PortfolioClient profile={profile} portfolios={portfolios ?? []} transactions={transactions ?? []} />
}
