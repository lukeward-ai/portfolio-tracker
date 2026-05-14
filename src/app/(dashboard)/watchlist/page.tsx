import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WatchlistClient } from './watchlist-client'

export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  return <WatchlistClient userId={user.id} watchlist={watchlist ?? []} />
}
