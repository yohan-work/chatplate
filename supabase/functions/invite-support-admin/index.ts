import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, requirePost } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const early = requirePost(request);
  if (early) return early;
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'AUTH_REQUIRED' }, 401);
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const jwt = authorization.replace(/^Bearer\s+/i, '');
  const { data: caller } = await service.auth.getUser(jwt);
  if (!caller.user) return json({ error: 'INVALID_SESSION' }, 401);
  const { data: owner } = await service.from('profiles')
    .select('id').eq('id', caller.user.id).eq('role', 'owner').eq('active', true).maybeSingle();
  if (!owner) return json({ error: 'OWNER_REQUIRED' }, 403);
  const body = await request.json().catch(() => ({})) as {
    email?: string;
    displayName?: string;
    role?: 'owner' | 'operator';
  };
  if (!body.email || !body.displayName) return json({ error: 'INVALID_INVITE' }, 400);
  const { data: invited, error } = await service.auth.admin.inviteUserByEmail(body.email);
  if (error || !invited.user) return json({ error: error?.message ?? 'INVITE_FAILED' }, 400);
  const { error: profileError } = await service.from('profiles').insert({
    id: invited.user.id,
    display_name: body.displayName.trim(),
    email: body.email.trim(),
    role: body.role ?? 'operator',
  });
  if (profileError) return json({ error: 'PROFILE_CREATE_FAILED' }, 500);
  return json({ id: invited.user.id, email: body.email });
});
