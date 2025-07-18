import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type UserRole = 'admin' | 'user';

export interface UserSession {
  id: string;
  email: string;
  role: UserRole;
}

export async function getUserSession(): Promise<UserSession | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  
  // Get user's role from the user_roles table
  const { data: userRoleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.session.user.id)
    .single();
  
  return {
    id: data.session.user.id,
    email: data.session.user.email || '',
    role: userRoleData?.role || 'user',
  };
}

export async function signOut() {
  return await supabase.auth.signOut();
}