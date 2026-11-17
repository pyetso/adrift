import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function cloudConfigured() { return Boolean(url && anonKey); }

// Create a fresh RLS-respecting client per request. Do not use a service-role key.
export function databaseClient(token) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token ? {global: {headers: {Authorization: `Bearer ${token}`}}} : {}),
  });
}
export async function authenticate(request) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) return null;
  const token = match[1];
  const client = databaseClient(token);
  const {data:{user},error} = await client.auth.getUser(token);
  return error || !user ? null : {client,user};
}

export const jsonError = (message,status) => Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
