'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Upload, CheckCircle2, AlertCircle, ChevronRight, Loader2, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseCSVFile, FORMAT_LABELS } from '@/lib/csv-import'
import type { ParseResult } from '@/lib/csv-import'
import { bulkImportTransactions } from './actions'

type Step = 'welcome' | 'upload' | 'review' | 'importing' | 'done'

interface Props {
  firstName: string
}

export function OnboardingClient({ firstName }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [brokerName, setBrokerName] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseCSVFile(text)
      setParseResult(result)
    }
    reader.readAsText(file)
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (!parseResult) return
    setStep('importing')
    setImportError('')

    const result = await bulkImportTransactions({
      brokerName: brokerName.trim() || 'My Portfolio',
      rows: parseResult.rows,
    })

    if (result.error) {
      setImportError(result.error)
      setStep('review')
      return
    }

    setImportedCount(result.imported)

    // Trigger backfill in the background (fire and forget — it runs server-side)
    try {
      await fetch('/api/portfolio-snapshots/backfill', { method: 'POST' })
    } catch {
      // Non-critical — dashboard still works, snapshots will backfill later
    }

    setStep('done')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] mb-4 shadow-sm">
            <LineChart className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Trackfolio</h1>
        </div>

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-8 text-center">
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Welcome, {firstName}!</h2>
            <p className="text-[#64748B] mb-6">
              Let&apos;s get your portfolio set up. It only takes a minute — upload your broker statements and we&apos;ll do the rest.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
              {[
                { n: '1', label: 'Upload statement' },
                { n: '2', label: 'Review trades' },
                { n: '3', label: 'Portfolio ready' },
              ].map(({ n, label }) => (
                <div key={n} className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-sm font-bold">{n}</div>
                  <span className="text-[#64748B]">{label}</span>
                </div>
              ))}
            </div>
            <Button
              className="w-full h-11 bg-[#0F172A] hover:bg-[#1e293b] text-white font-semibold"
              onClick={() => setStep('upload')}
            >
              Get started <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <button
              className="mt-4 text-sm text-[#64748B] hover:text-[#0F172A] underline"
              onClick={() => router.push('/dashboard')}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Add your brokerage</h2>
            <p className="text-sm text-[#64748B] mb-5">
              Give it a name and upload your trade history CSV. We support Revolut, Trading 212, Freetrade, and generic formats.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#0F172A]">Brokerage name</Label>
                <Input
                  placeholder="e.g. Revolut, Trading 212, ISA Account…"
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  className="h-10 border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#0F172A]">Trade history CSV</Label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    dragOver ? 'border-[#2563EB] bg-blue-50' : parseResult ? 'border-[#16A34A] bg-green-50' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onFileInput}
                  />
                  {parseResult ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-[#16A34A]" />
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{fileName}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {FORMAT_LABELS[parseResult.format]} · {parseResult.validRows} valid trades found
                        </p>
                      </div>
                      <button
                        className="text-xs text-[#64748B] hover:text-[#0F172A] underline"
                        onClick={(e) => { e.stopPropagation(); setParseResult(null); setFileName('') }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-[#94A3B8]" />
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">Drop your CSV here</p>
                        <p className="text-xs text-[#64748B] mt-0.5">or click to browse files</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 h-10 border-[#E2E8F0]"
                onClick={() => setStep('welcome')}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-10 bg-[#0F172A] hover:bg-[#1e293b] text-white font-semibold"
                disabled={!parseResult || parseResult.validRows === 0}
                onClick={() => setStep('review')}
              >
                Review trades
              </Button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && parseResult && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Review your trades</h2>
            <p className="text-sm text-[#64748B] mb-4">
              We found <strong>{parseResult.validRows}</strong> valid trades from your {FORMAT_LABELS[parseResult.format]} statement.
              {parseResult.invalidRows > 0 && ` ${parseResult.invalidRows} rows were skipped.`}
            </p>

            {importError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg mb-4">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {importError}
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total rows', value: parseResult.totalRows },
                { label: 'Valid trades', value: parseResult.validRows, green: true },
                { label: 'Skipped', value: parseResult.invalidRows, red: parseResult.invalidRows > 0 },
              ].map(({ label, value, green, red }) => (
                <div key={label} className="bg-[#F8FAFC] rounded-lg px-3 py-2.5 text-center">
                  <div className={`text-lg font-bold ${green ? 'text-[#16A34A]' : red ? 'text-red-500' : 'text-[#0F172A]'}`}>{value}</div>
                  <div className="text-xs text-[#64748B]">{label}</div>
                </div>
              ))}
            </div>

            {/* Transaction preview table */}
            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden mb-4">
              <div className="bg-[#F8FAFC] grid grid-cols-[80px_1fr_80px_80px] gap-2 px-3 py-2 text-xs font-medium text-[#64748B] border-b border-[#E2E8F0]">
                <span>Date</span>
                <span>Ticker</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-[#F1F5F9]">
                {parseResult.rows.filter((r) => r.valid).slice(0, 50).map((row) => (
                  <div key={row.id} className="grid grid-cols-[80px_1fr_80px_80px] gap-2 px-3 py-1.5 text-xs text-[#0F172A]">
                    <span className="text-[#64748B]">{row.date ? new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                    <span className="font-medium">{row.ticker} <span className={`text-[10px] px-1 py-0.5 rounded font-semibold ${row.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.type}</span></span>
                    <span className="text-right">{row.quantity}</span>
                    <span className="text-right">{row.currency} {row.price.toFixed(2)}</span>
                  </div>
                ))}
                {parseResult.validRows > 50 && (
                  <div className="px-3 py-2 text-xs text-[#64748B] text-center">
                    + {parseResult.validRows - 50} more trades
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10 border-[#E2E8F0]"
                onClick={() => setStep('upload')}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-10 bg-[#0F172A] hover:bg-[#1e293b] text-white font-semibold"
                onClick={handleImport}
              >
                Import {parseResult.validRows} trades
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-8 text-center">
            <Loader2 className="h-10 w-10 text-[#0F172A] animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#0F172A] mb-2">Importing your trades…</h2>
            <p className="text-sm text-[#64748B]">Analysing your portfolio and building your history.</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#16A34A] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">You&apos;re all set!</h2>
            <p className="text-sm text-[#64748B] mb-6">
              {importedCount} trades imported into <strong>{brokerName || 'your portfolio'}</strong>. Your portfolio analysis is ready.
            </p>
            <Button
              className="w-full h-11 bg-[#0F172A] hover:bg-[#1e293b] text-white font-semibold"
              onClick={() => router.push('/dashboard')}
            >
              Go to dashboard
            </Button>
          </div>
        )}

        {/* Step indicator */}
        {step !== 'importing' && step !== 'done' && (
          <div className="flex justify-center gap-2 mt-6">
            {(['welcome', 'upload', 'review'] as const).map((s) => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full transition-colors ${s === step ? 'bg-[#0F172A]' : 'bg-[#E2E8F0]'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
