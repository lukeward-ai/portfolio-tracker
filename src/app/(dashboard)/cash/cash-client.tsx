'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrency } from '@/lib/currency-context'
import { accountLabel } from '@/lib/portfolio-utils'
import { adjustCash } from './actions'
import { toast } from 'sonner'
import { Wallet, Building2, Check, X, Pencil } from 'lucide-react'
import type { Portfolio, CashPosition, Currency } from '@/lib/types'

const CURRENCY_FLAGS: Record<Currency, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧' }
const CURRENCIES: Currency[] = ['GBP', 'USD', 'EUR']

interface Props {
  portfolios: Portfolio[]
  cashPositions: CashPosition[]
}

interface EditKey { portfolioId: string; currency: Currency }

export function CashClient({ portfolios, cashPositions: initial }: Props) {
  const [positions, setPositions] = useState(initial)
  const [editing, setEditing] = useState<EditKey | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { format, convert } = useCurrency()

  const totalInBase = positions.reduce((sum, p) => sum + convert(p.amount, p.currency as Currency), 0)

  function getAmount(portfolioId: string, currency: Currency) {
    return positions.find((p) => p.portfolio_id === portfolioId && p.currency === currency)?.amount ?? 0
  }

  function startEdit(portfolioId: string, currency: Currency) {
    const current = getAmount(portfolioId, currency)
    setEditing({ portfolioId, currency })
    setEditValue(current === 0 ? '' : String(current))
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function cancelEdit() {
    setEditing(null)
    setEditValue('')
  }

  async function commitEdit() {
    if (!editing) return
    const newAmount = parseFloat(editValue)
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)
    const { data, error } = await adjustCash(editing.portfolioId, editing.currency, newAmount)
    if (error) {
      toast.error(error)
    } else if (data) {
      setPositions((prev) =>
        prev.some((p) => p.id === data.id)
          ? prev.map((p) => (p.id === data.id ? data : p))
          : [...prev, data]
      )
      toast.success('Cash balance updated')
    }
    setSaving(false)
    setEditing(null)
    setEditValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Cash</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cash reserves across your broker accounts</p>
      </div>

      {/* Total hero */}
      <Card className="border-[#2563EB]/20 bg-[#2563EB]/5">
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-[#2563EB]" />
            <p className="stat-label text-[#2563EB]">Total Cash</p>
          </div>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{format(totalInBase)}</p>
          <p className="text-xs text-muted-foreground mt-1">Across all accounts in display currency</p>
        </CardContent>
      </Card>

      {/* Per-broker tables */}
      <div className="space-y-4">
        {portfolios.map((portfolio) => {
          const pos = positions.filter((p) => p.portfolio_id === portfolio.id)
          const pTotal = pos.reduce((s, p) => s + convert(p.amount, p.currency as Currency), 0)

          return (
            <Card key={portfolio.id} className="border-border overflow-hidden">
              <CardHeader className="pb-0 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-[#2563EB]" />
                    </div>
                    {accountLabel(portfolio)}
                  </CardTitle>
                  <p className="text-sm font-semibold tabular-nums text-muted-foreground">{format(pTotal)}</p>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0 mt-3">
                <table className="w-full">
                  <tbody>
                    {CURRENCIES.map((cur, idx) => {
                      const amount = getAmount(portfolio.id, cur)
                      const inDisplay = convert(amount, cur)
                      const isEditing = editing?.portfolioId === portfolio.id && editing?.currency === cur
                      const isLast = idx === CURRENCIES.length - 1

                      return (
                        <tr
                          key={cur}
                          className={`group ${!isLast ? 'border-b border-border/60' : ''}`}
                        >
                          {/* Currency label */}
                          <td className="pl-5 py-3 w-24">
                            <div className="flex items-center gap-2">
                              <span className="text-base leading-none">{CURRENCY_FLAGS[cur]}</span>
                              <span className="text-xs font-semibold text-muted-foreground">{cur}</span>
                            </div>
                          </td>

                          {/* Amount — editable */}
                          <td className="py-3 pr-5">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  ref={inputRef}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  className="w-40 h-8 px-2.5 text-sm tabular-nums rounded-lg border border-[#2563EB] bg-background focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                                  placeholder="0.00"
                                  autoFocus
                                  disabled={saving}
                                />
                                <button
                                  onClick={commitEdit}
                                  disabled={saving}
                                  className="h-7 w-7 rounded-md bg-[#16A34A] text-white flex items-center justify-center hover:bg-[#15803d] transition-colors shrink-0"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className="h-7 w-7 rounded-md border border-border text-muted-foreground flex items-center justify-center hover:bg-accent transition-colors shrink-0"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-semibold tabular-nums">
                                    {format(amount, cur)}
                                  </span>
                                  {inDisplay !== amount && amount > 0 && (
                                    <span className="text-[11px] text-muted-foreground ml-2">
                                      ≈ {format(inDisplay)}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => startEdit(portfolio.id, cur)}
                                  className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md text-muted-foreground/60 flex items-center justify-center hover:bg-accent hover:text-foreground transition-all mr-2"
                                  title="Edit"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Click the pencil icon on any row to set the cash balance for that currency and account.
      </p>
    </div>
  )
}
