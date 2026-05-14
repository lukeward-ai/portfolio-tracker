import { DashboardClient } from './dashboard-client'

export default function DashboardPage() {
  return (
    <DashboardClient
      profile={null}
      portfolios={[]}
      transactions={[]}
      cashPositions={[]}
    />
  )
}
