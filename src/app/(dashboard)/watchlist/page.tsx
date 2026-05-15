export const dynamic = 'force-dynamic'

import { WatchlistClient } from './watchlist-client'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function WatchlistPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  return <WatchlistClient userId={user.id} watchlist={watchlist ?? []} />
}
