import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Uses the Service Role Key to bypass RLS and allow user creation
export const createAdminClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function setupBaseAdmin() {
    const supabaseAdmin = createAdminClient()
  
    // 1. Create the user safely via GoTrue (this fixes your login error)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@bddash.main', 
      password: 'XX1sir20!',
      email_confirm: true,
    })
  
    if (authError) {
      console.error('🚨 Failed to create auth user:', authError.message)
      return { success: false, error: authError.message }
    }
  
    // 2. Insert into your custom profiles table
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          username: 'admin',
          role: 'admin'
        })
        
      if (profileError) {
        console.error('🚨 Failed to create profile:', profileError.message)
        return { success: false, error: profileError.message }
      } 
      
      console.log('✅ Admin user and profile successfully created!')
      return { success: true }
    }
  }