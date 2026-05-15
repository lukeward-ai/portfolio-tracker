export const dynamic = 'force-dynamic'

import { HistoryClient } from './history-client'
import { requireUser } from '@/lib/auth'
import { getPortfolioSnapshots } from './actions'

export default async function HistoryPage() {
  await requireUser()
  const snapshots = await getPortfolioSnapshots('1Y')
  return <HistoryClient initialSnapshots={snapshots} />
}
