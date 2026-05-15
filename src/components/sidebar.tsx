'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/lib/currency-context'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LayoutDashboard,
  TrendingUp,
  ArrowLeftRight,
  Star,
  BarChart3,
  LogOut,
  Wallet,
  LineChart,
  Settings,
  History,
  Calculator,
  PackageX,
  Brain,
} from 'lucide-react'
import type { Profile, Currency } from '@/lib/types'

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/portfolio',       label: 'Portfolio',          icon: TrendingUp },
  { href: '/transactions',    label: 'Transactions',       icon: ArrowLeftRight },
  { href: '/sold-positions',  label: 'Sold Positions',     icon: PackageX },
  { href: '/watchlist',       label: 'Watchlist',          icon: Star },
  { href: '/cash',            label: 'Cash',               icon: Wallet },
  { href: '/pnl',             label: 'P&L & Tax',          icon: BarChart3 },
  { href: '/history',         label: 'Portfolio History',  icon: History },
  { href: '/ai-analysis',     label: 'AI Analysis',        icon: Brain },
  { href: '/projections',     label: 'Projections',        icon: Calculator },
  { href: '/settings',        label: 'Settings',           icon: Settings },
]

export function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const { currency, setCurrency } = useCurrency()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  return (
    <aside className="w-64 flex flex-col h-full shrink-0 bg-sidebar border-r border-sidebar-border">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
          <LineChart className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground leading-none tracking-tight">Trackfolio</p>
          <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 leading-none truncate">
            Track your portfolio
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sidebar-primary text-white shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-sidebar-foreground/60')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-3">
        {/* Currency selector */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-1">
            Display Currency
          </p>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v as Currency)}>
            <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">🇺🇸 USD — US Dollar</SelectItem>
              <SelectItem value="EUR">🇪🇺 EUR — Euro</SelectItem>
              <SelectItem value="GBP">🇬🇧 GBP — British Pound</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-1">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-[10px] font-semibold bg-sidebar-primary text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">
              {profile?.full_name ?? 'User'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5 leading-none">
              {profile?.email ?? ''}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
