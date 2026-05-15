'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LineChart, CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="h-12 w-12 text-[#16A34A] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Check your email</h2>
          <p className="text-sm text-[#64748B] mb-6">
            We sent a password reset link to <strong>{email}</strong>.
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

        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] mb-4 shadow-sm">
            <LineChart className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Trackfolio</h1>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-1">Reset your password</h2>
          <p className="text-sm text-[#64748B] mb-5">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

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

            <Button
              type="submit"
              className="w-full h-10 bg-[#0F172A] hover:bg-[#1e293b] text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>

          <p className="text-sm text-[#64748B] text-center mt-5">
            <Link href="/auth/login" className="text-[#2563EB] hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
