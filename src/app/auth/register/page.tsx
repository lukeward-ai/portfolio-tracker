'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [taxJurisdiction, setTaxJurisdiction] = useState('UK')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Update profile preferences (profile row created by DB trigger on auth.users insert)
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        base_currency: baseCurrency,
        tax_jurisdiction: taxJurisdiction,
      })

      // If session exists, we're signed in immediately (email confirmation disabled)
      if (data.session) {
        router.push('/dashboard')
        router.refresh()
        return
      }
    }

    // Email confirmation required
    setEmailSent(true)
    setLoading(false)
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="h-12 w-12 text-[#16A34A] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Check your email</h2>
          <p className="text-sm text-[#64748B] mb-6">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link href="/auth/login" className="text-sm text-[#2563EB] hover:underline font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] mb-4 shadow-sm">
            <LineChart className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Trackfolio</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Track your portfolio. Know your performance.</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Create your Trackfolio account</h2>
          <p className="text-sm text-[#64748B] mb-5">Start tracking your portfolio across brokers.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-xs font-medium text-[#0F172A]">Full name</Label>
              <Input
                id="full_name"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-10 border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-[#0F172A]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-[#0F172A]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="h-10 border-[#E2E8F0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#0F172A]">Base currency</Label>
                <Select value={baseCurrency} onValueChange={(v) => v && setBaseCurrency(v)}>
                  <SelectTrigger className="h-10 border-[#E2E8F0]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">🇬🇧 GBP</SelectItem>
                    <SelectItem value="USD">🇺🇸 USD</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#0F172A]">Tax rules</Label>
                <Select value={taxJurisdiction} onValueChange={(v) => v && setTaxJurisdiction(v)}>
                  <SelectTrigger className="h-10 border-[#E2E8F0]"><SelectValue /></SelectTrigger>
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
              className="w-full h-10 bg-[#0F172A] hover:bg-[#1e293b] text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-sm text-[#64748B] text-center mt-5">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#2563EB] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
