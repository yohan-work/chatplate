begin;
create extension if not exists pgtap with schema extensions;

select plan(10);
select has_table('public', 'bot_config_versions', 'versioned bot config table exists');
select has_table('public', 'support_conversation_participants', 'conversation participants exist');
select has_table('public', 'support_audit_events', 'support audit table exists');
select has_table('public', 'notification_outbox', 'notification outbox exists');
select has_table('public', 'support_resume_tokens', 'resume token table exists');
select has_table('public', 'support_search_events', 'search event table exists');
select has_function('public', 'query_support_conversations', array[
  'text', 'support_conversation_status', 'text', 'text', 'text', 'uuid', 'integer'
], 'cursor inbox query RPC exists');
select has_function('public', 'transfer_support_conversation', array['uuid', 'uuid'], 'transfer RPC exists');
select has_function('public', 'publish_bot_config', array['text', 'integer'], 'publish RPC exists');
select has_function('public', 'anonymize_expired_support_contacts', array[
  'integer', 'timestamp with time zone'
], 'retention RPC exists');

select * from finish();
rollback;
