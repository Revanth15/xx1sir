'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { notify } from '@/utils/toast'
import { revalidatePath } from 'next/cache'

export async function createAccount(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const { data: profileData } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  if (profileData?.role !== 'admin') throw new Error('Not authorized')

  const adminSupabase = createAdminClient()
  const username = formData.get('username') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string
  
  const dummyEmail = `${username}@bddash.main`

  console.log(dummyEmail)
  console.log(password)
  
  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email: dummyEmail,
    password,
    email_confirm: true,
  })

  if (createError) throw new Error(createError.message)

  if (newUser.user) {
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .insert({ 
        user_id: newUser.user.id, 
        username: username,
        role: role 
      })

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(newUser.user.id)
      notify.error("Database insertion failed. User creation rolled back.")
      // throw new Error('Database insertion failed. User creation rolled back.')
    }
  }

  revalidatePath('/admin')
}

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  
  const { data: profileData } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  if (profileData?.role !== 'admin') throw new Error('Not authorized')
  return true
}

export async function deleteUser(userId: string) {
  await verifyAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
}

export async function updateUserPassword(userId: string, newPassword: string) {
  await verifyAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
    password: newPassword
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function updateUserInfo(userId: string, updates: { username?: string; role?: string }) {
  await verifyAdmin()
  const adminSupabase = createAdminClient()

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)

  if (profileError) throw new Error(profileError.message)

  // 2. If username changed, we also need to update the email in Auth 
  // because your system uses {username}@bddash.main as the login
  if (updates.username) {
    const newEmail = `${updates.username}@bddash.main`
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
      email: newEmail,
    })
    if (authError) throw new Error(authError.message)
  }

  revalidatePath('/admin')
}