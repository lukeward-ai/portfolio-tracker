export const dynamic = 'force-dynamic'

import { HistoryClient } from './history-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function HistoryPage() {
  await requireUser()
  const supabase = await createClient()

  const { data: snapshots } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: true })
    .limit(10000)

  return <HistoryClient initialSnapshots={(snapshots ?? []) as Parameters<typeof HistoryClient>[0]['initialSnapshots']} />
}
