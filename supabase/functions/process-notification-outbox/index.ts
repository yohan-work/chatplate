import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, requirePost } from '../_shared/http.ts';

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const early = requirePost(request);
  if (early) return early;
  if (request.headers.get('x-cron-secret') !== Deno.env.get('OUTBOX_CRON_SECRET')) {
    return json({ error: 'FORBIDDEN' }, 403);
  }
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: items, error } = await service
    .from('notification_outbox')
    .select('id, conversation_id, message_id, channel, attempts')
    .in('status', ['pending', 'failed'])
    .lte('available_at', new Date().toISOString())
    .order('available_at')
    .limit(50);
  if (error) return json({ error: 'OUTBOX_READ_FAILED' }, 500);
  let sent = 0;
  const processedConversations = new Set<string>();
  for (const item of items ?? []) {
    if (processedConversations.has(item.conversation_id)) {
      await service.from('notification_outbox')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      continue;
    }
    processedConversations.add(item.conversation_id);
    await service.from('notification_outbox')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .in('status', ['pending', 'failed']);
    try {
      const resumeToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
      const { error: tokenError } = await service.from('support_resume_tokens').insert({
        conversation_id: item.conversation_id,
        token_hash: await sha256(resumeToken),
      });
      if (tokenError) throw tokenError;
      // Provider-neutral default. Replace this log branch with email/SMS/Kakao adapters at deployment.
      console.log(JSON.stringify({
        type: 'support_reply_notification',
        resumeTokenSuffix: resumeToken.slice(-6),
        ...item,
      }));
      await service.from('notification_outbox')
        .update({ status: 'sent', attempts: item.attempts + 1, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      sent += 1;
    } catch (nextError) {
      const attempts = item.attempts + 1;
      await service.from('notification_outbox').update({
        status: attempts >= 5 ? 'dead' : 'failed',
        attempts,
        last_error: nextError instanceof Error ? nextError.message : 'UNKNOWN_PROVIDER_ERROR',
        available_at: new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
    }
  }
  return json({ processed: items?.length ?? 0, sent });
});
