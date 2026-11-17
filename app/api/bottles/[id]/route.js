import {authenticate,cloudConfigured,jsonError} from '../../../../lib/supabase-server';
import {validateEdit} from '../../../../lib/validation.mjs';

export const dynamic = 'force-dynamic';
export async function PUT(request,{params}) {
  if (!cloudConfigured()) return jsonError('Cloud storage is not configured.',503);
  const identity = await authenticate(request);
  if (!identity) return jsonError('Not signed in.',401);
  const {id} = await params;
  let body;
  try {body=await request.json();} catch {return jsonError('Invalid JSON.',400);}
  const parsed=validateEdit(body);
  if (parsed.error) return jsonError(parsed.error,400);
  const {data,error} = await identity.client.from('bottles')
    .update({message:parsed.value.message}).eq('id',id).eq('owner_id',identity.user.id)
    .select('id,message,author_name,mood,start_x,start_z,drift_seed,created_at').maybeSingle();
  if (error) return jsonError('Unable to update this letter.',500);
  if (!data) return jsonError('This letter was not found or is not yours.',404);
  return Response.json({bottle:data});
}
export async function DELETE(request,{params}) {
  if (!cloudConfigured()) return jsonError('Cloud storage is not configured.',503);
  const identity = await authenticate(request);
  if (!identity) return jsonError('Not signed in.',401);
  const {id} = await params;
  const {data,error} = await identity.client.from('bottles')
    .delete().eq('id',id).eq('owner_id',identity.user.id).select('id').maybeSingle();
  if (error) return jsonError('Could not remove your letter.',500);
  if (!data) return jsonError('This letter was not found or is not yours.',404);
  return Response.json({deleted:true});
}
