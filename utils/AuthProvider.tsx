'use client'

import { createContext, useContext, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { notify } from './toast'

// Match this to your public.profiles table schema
export type UserProfile = {
  user_id: string
  username: string
  role: 'admin' | 'user' | 's4_brn' | 'coy_ic'
  created_at: string
}

type AuthContextType = {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
}

// Default state is loading until the server passes the data down
const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
})

export function AuthProvider({
  children,
  user,
  profile,
}: {
  children: ReactNode
  user: User | null
  profile: UserProfile | null
}) {
  return (
    <AuthContext.Provider value={{ user, profile, isLoading: false }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}