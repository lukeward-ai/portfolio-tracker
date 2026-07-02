export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { UpcomingEventsClient } from './upcoming-events-client'
import { fetchAllTransactions } from '@/lib/fetch-transactions'

export default async function UpcomingEventsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [
    { data: profile },
    transactions,
    { data: watchlist },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    fetchAllTransactions(supabase, user.id),
    supabase.from('watchlist').select('*').eq('user_id', user.id),
  ])

  return (
    <UpcomingEventsClient
      profile={profile}
      transactions={transactions}
      watchlist={watchlist ?? []}
    />
  )
}
