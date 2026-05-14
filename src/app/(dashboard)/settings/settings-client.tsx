'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCurrency } from '@/lib/currency-context'
import { accountLabel } from '@/lib/portfolio-utils'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Building2, User, AlertTriangle } from 'lucide-react'
import type { Profile, Portfolio, CashPosition, Currency } from '@/lib/types'

interface Props {
  userId: string
  profile: Profile | null
  portfolios: Portfolio[]
  txCountByPortfolio: Record<string, number>
  cashPositions: CashPosition[]
}

interface EditState { id: string; name: string; broker: string }

export function SettingsClient({ userId, profile, portfolios: initial, txCountByPortfolio, cashPositions }: Props) {
  const [portfolios, setPortfolios] = useState(initial)
  const [newBroker, setNewBroker] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Portfolio | null>(null)
  const [saving, setSaving] = useState(false)

  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [baseCurrency, setBaseCurrency] = useState<Currency>(profile?.base_currency ?? 'GBP')
  const [taxJurisdiction, setTaxJurisdiction] = useState(profile?.tax_jurisdiction ?? 'UK')
  const [savingProfile, setSavingProfile] = useState(false)

  const { convert, format } = useCurrency()
  const router = useRouter()

  function cashForPortfolio(portfolioId: string) {
    return cashPositions
      .filter((c) => c.portfolio_id === portfolioId)
      .reduce((s, c) => s + convert(c.amount, c.currency as Currency), 0)
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!newBroker.trim()) { toast.error('Broker name is required'); return }
    setSaving(true)
    const supabase = createClient()
    const name = newName.trim() || newBroker.trim()
    const broker = newBroker.trim()

    const { data, error } = await supabase.from('portfolios').insert({
      user_id: userId,
      name,
      description: broker,
    }).select().single()

    if (error) { toast.error(error.message); setSaving(false); return }

    // Create zero cash positions
    await supabase.from('cash_positions').insert([
      { portfolio_id: data.id, user_id: userId, currency: 'USD', amount: 0 },
      { portfolio_id: data.id, user_id: userId, currency: 'EUR', amount: 0 },
      { portfolio_id: data.id, user_id: userId, currency: 'GBP', amount: 0 },
    ])

    setPortfolios([...portfolios, data])
    setNewBroker(''); setNewName(''); setAdding(false)
    toast.success(`Account "${accountLabel(data)}" created`)
    router.refresh()
    setSaving(false)
  }

  async function handleEditAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    const supabase = createClient()
    const name = editing.name.trim() || editing.broker.trim()

    const { data, error } = await supabase.from('portfolios')
      .update({ name, description: editing.broker.trim() })
      .eq('id', editing.id)
      .select().single()

    if (error) { toast.error(error.message); setSaving(false); return }
    setPortfolios(portfolios.map((p) => p.id === data.id ? data : p))
    setEditing(null)
    toast.success('Account updated')
    router.refresh()
    setSaving(false)
  }

  async function handleDeleteAccount(portfolio: Portfolio) {
    const txCount = txCountByPortfolio[portfolio.id] ?? 0
    if (txCount > 0) {
      toast.error(`Cannot delete — this account has ${txCount} transaction${txCount !== 1 ? 's' : ''}`)
      setConfirmDelete(null)
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('portfolios').delete().eq('id', portfolio.id)
    if (error) { toast.error(error.message); return }
    setPortfolios(portfolios.filter((p) => p.id !== portfolio.id))
    setConfirmDelete(null)
    toast.success('Account deleted')
    router.refresh()
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      base_currency: baseCurrency,
      tax_jurisdiction: taxJurisdiction,
    }).eq('id', userId)

    if (error) { toast.error(error.message) } else { toast.success('Profile saved') }
    setSavingProfile(false)
    router.refresh()
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your broker accounts and profile</p>
      </div>

      {/* Broker Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Broker Accounts
            </CardTitle>
            <Button
              size="sm"
              className="gap-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white h-8 text-xs"
              onClick={() => setAdding(!adding)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* Add account form */}
          {adding && (
            <form onSubmit={handleAddAccount} className="flex gap-3 items-end p-4 bg-muted/40 rounded-xl border border-border">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-medium">Broker name</Label>
                <Input
                  placeholder="e.g. Trading 212, Davy, Freetrade"
                  value={newBroker}
                  onChange={(e) => setNewBroker(e.target.value)}
                  className="h-9 text-sm"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-medium">Account label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. ISA, Invest — leave blank to use broker name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => { setAdding(false); setNewBroker(''); setNewName('') }}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-9 bg-[#2563EB] hover:bg-[#1d4ed8] text-white" disabled={saving}>
                  {saving ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          )}

          {/* Account list */}
          <div className="space-y-2">
            {portfolios.map((p) => {
              const txCount = txCountByPortfolio[p.id] ?? 0
              const cash = cashForPortfolio(p.id)
              return (
                <div key={p.id} className="flex items-center justify-between py-3 px-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-[#2563EB]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none">{accountLabel(p)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {txCount} trade{txCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">{format(cash)} cash</span>
                        {p.description && p.description !== p.name && (
                          <>
                            <span className="text-[11px] text-muted-foreground">·</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{p.description}</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-foreground"
                      onClick={() => setEditing({ id: p.id, name: p.name, broker: p.description ?? '' })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
                      onClick={() => setConfirmDelete(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {portfolios.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No accounts yet. Add your first broker account above.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit account dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit Account</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleEditAccount} className="space-y-4 mt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Broker name</Label>
                <Input
                  value={editing.broker}
                  onChange={(e) => setEditing({ ...editing, broker: e.target.value })}
                  className="h-9"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Account label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. ISA — leave blank to use broker name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">{accountLabel(confirmDelete)}</span>?
                {(txCountByPortfolio[confirmDelete.id] ?? 0) > 0 && (
                  <span className="block mt-1 text-destructive">
                    This account has {txCountByPortfolio[confirmDelete.id]} transactions and cannot be deleted.
                  </span>
                )}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteAccount(confirmDelete)}
                  disabled={(txCountByPortfolio[confirmDelete.id] ?? 0) > 0}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="max-w-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Display currency</Label>
                <Select value={baseCurrency} onValueChange={(v) => v && setBaseCurrency(v as Currency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">🇬🇧 GBP</SelectItem>
                    <SelectItem value="USD">🇺🇸 USD</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tax rules</Label>
                <Select value={taxJurisdiction} onValueChange={(v) => v && setTaxJurisdiction(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UK">🇬🇧 UK (CGT)</SelectItem>
                    <SelectItem value="US">🇺🇸 US (IRS)</SelectItem>
                    <SelectItem value="EU">🇪🇺 EU</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              className="bg-[#0F172A] hover:bg-[#1e293b] text-white"
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  )
}
