export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { UpcomingEventsClient } from './upcoming-events-client'

export default async function UpcomingEventsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [
    { data: transactions },
    { data: watchlist },
  ] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: true }),
    supabase.from('watchlist').select('*').eq('user_id', user.id),
  ])

  return (
    <UpcomingEventsClient
      transactions={transactions ?? []}
      watchlist={watchlist ?? []}
    />
  )
}
