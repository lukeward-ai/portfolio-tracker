import { Sidebar } from '@/components/sidebar'
import { CurrencyProvider } from '@/lib/currency-context'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider defaultCurrency="USD">
      <div className="flex h-screen bg-background">
        <Sidebar profile={null} />
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
