export const dynamic = 'force-dynamic'

import { WatchlistClient } from './watchlist-client'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function WatchlistPage() {
  const db = createAdminClient()
  const userId = DEMO_USER_ID

  const { data: watchlist } = await db
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })

  return <WatchlistClient userId={userId} watchlist={watchlist ?? []} />
}
