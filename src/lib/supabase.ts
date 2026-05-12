import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hhtevkdqhbsfwwheaekz.supabase.co'
const supabaseAnonKey = 'sb_publishable_WG9ul5Y4Zh1NJNG0AvKZAA_e4mflsva'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserProfile = {
  id: string
  email: string
  username: string
}