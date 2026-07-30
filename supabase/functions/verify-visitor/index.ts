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
  const { data: userData } = await service.auth.getUser(jwt);
  if (!userData.user) return json({ error: 'INVALID_SESSION' }, 401);
  const body = await request.json().catch(() => ({})) as { botId?: string; captchaToken?: string };
  if (!body.botId || !body.captchaToken) return json({ error: 'INVALID_VERIFICATION' }, 400);
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return json({ error: 'TURNSTILE_NOT_CONFIGURED' }, 503);
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', body.captchaToken);
  const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  }).then((response) => response.json()) as { success?: boolean; hostname?: string };
  if (!verification.success) return json({ error: 'CAPTCHA_FAILED' }, 403);
  const { data: settings } = await service.from('bot_security_settings')
    .select('allowed_origins').eq('bot_id', body.botId).maybeSingle();
  const origin = request.headers.get('origin');
  if (settings?.allowed_origins?.length && (!origin || !settings.allowed_origins.includes(origin))) {
    return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
  }
  const { error } = await service.from('support_verified_visitors').upsert({
    user_id: userData.user.id,
    bot_id: body.botId,
    verified_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    origin,
  });
  if (error) return json({ error: 'VERIFICATION_STORE_FAILED' }, 500);
  return json({ verified: true });
});
