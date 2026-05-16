import { Sidebar } from '@/components/sidebar'
import { CurrencyProvider } from '@/lib/currency-context'
import { TickerDrawerProvider } from '@/lib/ticker-drawer-context'
import { TickerDrawer } from '@/components/ticker-drawer'
import { PortfolioAIChat } from '@/components/portfolio-ai-chat'
import { Toaster } from '@/components/ui/sonner'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

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
        <PortfolioAIChat />
        <Toaster />
      </TickerDrawerProvider>
    </CurrencyProvider>
  )
}
