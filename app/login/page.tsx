'use client'

import { useState, useTransition } from 'react'
import { loginAction } from './actions'
import { notify } from '@/utils/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()

  const handleFormAction = async (formData: FormData) => {
    startTransition(async () => {
      const result = await loginAction(formData)
      
      if (result?.error) {
        notify.error('Authentication Failed', result.error)
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans selection:bg-primary/20">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card p-8 shadow-sm sm:p-10">
        
        {/* Header Section */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg">
             <svg className="h-6 w-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
             </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            Barracks Portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Damage report & maintenance tracking
          </p>
        </div>

        {/* Updated Form using 'action' prop */}
        <form action={handleFormAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="ml-1 text-sm font-medium text-foreground">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              disabled={isPending}
              className="rounded-xl border-input bg-background px-4 py-6 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Enter your username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="ml-1 text-sm font-medium text-foreground">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              disabled={isPending}
              className="rounded-xl border-input bg-background px-4 py-6 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-70"
            >
              {isPending ? 'Signing In...' : 'Sign In'}
            </Button>
          </div>
        </form>

      </div>
    </div>
  )
}