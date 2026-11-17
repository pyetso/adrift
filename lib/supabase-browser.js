import { createClient } from '@supabase/supabase-js';

let browserClient;
export function isCloudConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function getBrowserClient() {
  if (!isCloudConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return browserClient;
}
export async function getAccessToken() {
  const client = getBrowserClient();
  if (!client) return null;
  const {data:{session},error:sessionError} = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (session?.access_token) return session.access_token;
  const {data,error} = await client.auth.signInAnonymously();
  if (error) throw new Error('Anonymous sign-in failed. Enable it in Supabase Authentication settings.');
  return data.session?.access_token;
}
