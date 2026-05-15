export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import { UpcomingEventsClient } from './upcoming-events-client'

export default async function UpcomingEventsPage() {
  const db = createAdminClient()

  const [
    { data: transactions },
    { data: watchlist },
  ] = await Promise.all([
    db.from('transactions').select('*').eq('user_id', DEMO_USER_ID).order('executed_at', { ascending: true }),
    db.from('watchlist').select('*').eq('user_id', DEMO_USER_ID),
  ])

  return (
    <UpcomingEventsClient
      transactions={transactions ?? []}
      watchlist={watchlist ?? []}
    />
  )
}
