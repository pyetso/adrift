import {authenticate,cloudConfigured,jsonError} from '../../../../lib/supabase-server';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!cloudConfigured()) return jsonError('Connect Supabase for account-backed letters.',503);
  const identity = await authenticate(request);
  if (!identity) return jsonError('Not signed in.',401);
  const {data,error} = await identity.client.from('bottles')
    .select('id,message,author_name,mood,start_x,start_z,drift_seed,created_at,status')
    .eq('owner_id',identity.user.id).order('created_at',{ascending:false}).limit(80);
  if (error) return jsonError('Could not load your letters.',500);
  return Response.json({bottles:data},{headers:{'Cache-Control':'no-store'}});
}
