import { Sidebar } from '@/components/sidebar'
import { CurrencyProvider } from '@/lib/currency-context'
import { Toaster } from '@/components/ui/sonner'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const db = createAdminClient()
  const { data: profile } = await db.from('profiles').select('*').eq('id', DEMO_USER_ID).single()

  return (
    <CurrencyProvider defaultCurrency={profile?.base_currency ?? 'GBP'}>
      <div className="flex h-screen bg-background">
        <Sidebar profile={profile} />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </CurrencyProvider>
  )
}
