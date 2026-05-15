import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from './onboarding-client'

export default async function OnboardingPage() {
  const user = await requireUser()
  const supabase = await createClient()

  // Already has portfolios — skip onboarding
  const { count } = await supabase
    .from('portfolios')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count && count > 0) {
    redirect('/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return <OnboardingClient firstName={firstName} />
}
