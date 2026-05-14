export const dynamic = 'force-dynamic'

import { HistoryClient } from './history-client'
import { getPortfolioSnapshots } from './actions'

export default async function HistoryPage() {
  const snapshots = await getPortfolioSnapshots('ALL')

  return <HistoryClient initialSnapshots={snapshots} />
}
