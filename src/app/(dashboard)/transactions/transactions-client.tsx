'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/lib/currency-context'
import { accountLabel } from '@/lib/portfolio-utils'
import { toast } from 'sonner'
import { Plus, Search, Trash2, ArrowLeftRight } from 'lucide-react'
import { format as formatDate } from 'date-fns'
import type { Portfolio, Transaction, Currency } from '@/lib/types'

interface SearchResult { ticker: string; name: string; exchange: string }

interface Props {
  userId: string
  portfolios: Portfolio[]
  transactions: Transaction[]
}

export function TransactionsClient({ userId, portfolios, transactions: initial }: Props) {
  const [transactions, setTransactions] = useState(initial)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedTicker, setSelectedTicker] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [fees, setFees] = useState('0')
  const [notes, setNotes] = useState('')
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().slice(0, 16))
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? '')
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [filterPortfolio, setFilterPortfolio] = useState<string>('ALL')

  const { format } = useCurrency()
  const router = useRouter()

  const portfolioMap = Object.fromEntries(portfolios.map((p) => [p.id, p]))

  const searchTickers = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data.results ?? [])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTicker) { toast.error('Please select a stock'); return }
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.from('transactions').insert({
      portfolio_id: portfolioId,
      user_id: userId,
      type,
      ticker: selectedTicker,
      name: selectedName,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      currency,
      fees: parseFloat(fees) || 0,
      notes: notes || null,
      executed_at: new Date(executedAt).toISOString(),
    }).select().single()

    if (error) {
      toast.error(error.message)
    } else {
      setTransactions([data, ...transactions])
      toast.success(`${type} order logged`)
      setOpen(false)
      resetForm()
      router.refresh()
    }
    setLoading(false)
  }

  function resetForm() {
    setSelectedTicker(''); setSelectedName(''); setSearchQuery(''); setSearchResults([])
    setQuantity(''); setPrice(''); setFees('0'); setNotes('')
    setExecutedAt(new Date().toISOString().slice(0, 16))
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setTransactions(transactions.filter((t) => t.id !== id))
    toast.success('Transaction deleted')
    router.refresh()
  }

  const filtered = transactions.filter((t) =>
    (filterType === 'ALL' || t.type === filterType) &&
    (filterPortfolio === 'ALL' || t.portfolio_id === filterPortfolio)
  )

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your complete trade history</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white gap-2">
          <Plus className="h-4 w-4" />Log Trade
        </Button>
      </div>

      {/* Log Trade Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Log a Trade</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">

            {/* Buy / Sell */}
            <div className="grid grid-cols-2 gap-2">
              {(['BUY', 'SELL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`h-9 rounded-lg text-sm font-semibold transition-all border ${
                    type === t && t === 'BUY'
                      ? 'bg-[#16A34A] text-white border-transparent shadow-sm'
                      : type === t && t === 'SELL'
                      ? 'bg-[#DC2626] text-white border-transparent shadow-sm'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Account */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Account</Label>
              <Select value={portfolioId} onValueChange={(v) => v && setPortfolioId(v)}>
                <SelectTrigger>
                  <span className="text-sm truncate">
                    {portfolios.find((p) => p.id === portfolioId)
                      ? accountLabel(portfolios.find((p) => p.id === portfolioId)!)
                      : 'Select account'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map((p) => <SelectItem key={p.id} value={p.id}>{accountLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Ticker search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Stock / ETF</Label>
              {selectedTicker ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-muted/30">
                  <span className="font-semibold text-sm">{selectedTicker}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{selectedName}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => { setSelectedTicker(''); setSelectedName('') }}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-8"
                      placeholder="Search ticker or company name..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); searchTickers(e.target.value) }}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-auto">
                      {searchResults.map((r) => (
                        <button
                          key={r.ticker}
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors first:rounded-t-lg last:rounded-b-lg"
                          onClick={() => { setSelectedTicker(r.ticker); setSelectedName(r.name); setSearchResults([]) }}
                        >
                          <span className="font-semibold text-sm w-14 shrink-0">{r.ticker}</span>
                          <span className="text-xs text-muted-foreground flex-1 truncate">{r.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{r.exchange}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Quantity</Label>
                <Input type="number" step="any" min="0" value={quantity}
                  onChange={(e) => setQuantity(e.target.value)} required className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Price per share</Label>
                <Input type="number" step="any" min="0" value={price}
                  onChange={(e) => setPrice(e.target.value)} required className="tabular-nums" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Currency</Label>
                <Select value={currency} onValueChange={(v) => v && setCurrency(v as Currency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">🇺🇸 USD</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                    <SelectItem value="GBP">🇬🇧 GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Fees</Label>
                <Input type="number" step="any" min="0" value={fees}
                  onChange={(e) => setFees(e.target.value)} className="tabular-nums" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date &amp; Time</Label>
              <Input type="datetime-local" value={executedAt}
                onChange={(e) => setExecutedAt(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="Reason for trade..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                type="submit" disabled={loading}
                className={type === 'BUY' ? 'bg-[#16A34A] hover:bg-[#15803d] text-white' : 'bg-[#DC2626] hover:bg-[#b91c1c] text-white'}
              >
                {loading ? 'Saving...' : `Log ${type}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              Trade History
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {/* Type filter */}
              {(['ALL', 'BUY', 'SELL'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`h-7 px-3 text-xs font-medium rounded-md transition-all ${
                    filterType === f
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
              {/* Divider */}
              <div className="w-px bg-border mx-0.5" />
              {/* Portfolio filter */}
              <button
                onClick={() => setFilterPortfolio('ALL')}
                className={`h-7 px-3 text-xs font-medium rounded-md transition-all ${
                  filterPortfolio === 'ALL'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                All accounts
              </button>
              {portfolios.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFilterPortfolio(p.id)}
                  className={`h-7 px-3 text-xs font-medium rounded-md transition-all ${
                    filterPortfolio === p.id
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {accountLabel(p)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-16">
                    <p className="text-sm font-medium">No transactions found</p>
                    <p className="text-xs mt-1">
                      {filterPortfolio !== 'ALL' || filterType !== 'ALL'
                        ? 'Try changing the filters above'
                        : 'Log your first trade using the button above'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tx) => {
                  const portfolio = portfolioMap[tx.portfolio_id]
                  return (
                    <TableRow key={tx.id} className="border-border">
                      <TableCell className="pl-6 text-sm text-muted-foreground tabular-nums">
                        {formatDate(new Date(tx.executed_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] font-bold px-1.5 ${
                            tx.type === 'BUY'
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                              : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                          }`}
                          variant="outline"
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {portfolio ? (
                          <span className="text-xs text-muted-foreground font-medium">
                            {accountLabel(portfolio)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">{tx.ticker}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[110px]">{tx.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{tx.quantity}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{format(tx.price, tx.currency as Currency)}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {format(tx.price * tx.quantity, tx.currency as Currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {format(tx.fees ?? 0, tx.currency as Currency)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)}
                          className="h-7 w-7 text-muted-foreground/40 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
