import {authenticate,cloudConfigured,jsonError} from '../../../../../lib/supabase-server';
export const dynamic = 'force-dynamic';
export async function POST(request,{params}) {
  if (!cloudConfigured()) return jsonError('Cloud storage is not configured.',503);
  const identity = await authenticate(request);
  if (!identity) return jsonError('Not signed in.',401);
  const {id} = await params;
  const {error} = await identity.client.from('bottle_reports').insert({
    bottle_id:id,reporter_id:identity.user.id
  });
  if (error?.code === '23505') return Response.json({reported:true});
  if (error) return jsonError('Unable to report this letter.',500);
  return Response.json({reported:true},{status:201});
}
