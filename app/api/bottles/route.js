import {authenticate,cloudConfigured,databaseClient,jsonError} from '../../../lib/supabase-server';
import {validateBottle,positionForNewBottle} from '../../../lib/validation.mjs';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!cloudConfigured()) return Response.json({bottles:[],demo:true});
  const {data,error} = await databaseClient().from('bottles')
    .select('id,message,author_name,mood,start_x,start_z,drift_seed,created_at')
    .eq('status','floating').order('created_at',{ascending:false}).limit(80);
  if (error) return jsonError('Unable to load letters from the sea.',502);
  return Response.json({bottles:data},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request) {
  if (!cloudConfigured()) return jsonError('Connect Supabase to publish letters to the shared ocean.',503);
  const identity = await authenticate(request);
  if (!identity) return jsonError('Please start an anonymous session before writing.',401);
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON.',400); }
  const parsed = validateBottle(body);
  if (parsed.error) return jsonError(parsed.error,400);
  const {data,error} = await identity.client.from('bottles')
    .insert({...parsed.value,...positionForNewBottle(body),owner_id:identity.user.id,status:'floating'})
    .select('id,message,author_name,mood,start_x,start_z,drift_seed,created_at').single();
  if (error) return jsonError('Could not release your bottle. Please try again.',500);
  return Response.json({bottle:data},{status:201});
}
