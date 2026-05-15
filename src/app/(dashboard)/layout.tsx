import { Sidebar } from '@/components/sidebar'
import { CurrencyProvider } from '@/lib/currency-context'
import { TickerDrawerProvider } from '@/lib/ticker-drawer-context'
import { TickerDrawer } from '@/components/ticker-drawer'
import { Toaster } from '@/components/ui/sonner'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const db = createAdminClient()
  const { data: profile } = await db.from('profiles').select('*').eq('id', DEMO_USER_ID).single()

  return (
    <CurrencyProvider defaultCurrency={profile?.base_currency ?? 'GBP'}>
      <TickerDrawerProvider>
        <div className="flex h-screen bg-background">
          <Sidebar profile={profile} />
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
        <TickerDrawer />
        <Toaster />
      </TickerDrawerProvider>
    </CurrencyProvider>
  )
}
