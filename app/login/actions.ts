'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  // Format the username 
  const dummyEmail = `${username}@bddash.main`

  const { error } = await supabase.auth.signInWithPassword({ 
    email: dummyEmail, 
    password 
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}