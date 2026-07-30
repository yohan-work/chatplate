import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, requirePost } from '../_shared/http.ts';

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const early = requirePost(request);
  if (early) return early;
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'AUTH_REQUIRED' }, 401);
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'INVALID_SESSION' }, 401);
  const body = await request.json().catch(() => ({})) as { token?: string };
  if (!body.token || body.token.length < 32) return json({ error: 'INVALID_RESUME_TOKEN' }, 400);
  const tokenHash = await sha256(body.token);
  const { data: resumeToken } = await service
    .from('support_resume_tokens')
    .select('id, conversation_id, expires_at, redeemed_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!resumeToken || resumeToken.revoked_at || resumeToken.redeemed_at ||
      new Date(resumeToken.expires_at).getTime() <= Date.now()) {
    return json({ error: 'RESUME_TOKEN_EXPIRED' }, 410);
  }
  const { error: participantError } = await service
    .from('support_conversation_participants')
    .upsert({ conversation_id: resumeToken.conversation_id, user_id: userData.user.id });
  if (participantError) return json({ error: 'RESUME_FAILED' }, 500);
  await service.from('support_resume_tokens')
    .update({ redeemed_at: new Date().toISOString() })
    .eq('id', resumeToken.id);
  return json({ conversationId: resumeToken.conversation_id });
});
