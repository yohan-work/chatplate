import { describe, expect, it } from 'vitest';
import type { AdminProfile } from '../types/chatbot';
import { LocalChatRepository } from './localChatRepository';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const admin: AdminProfile = {
  id: 'admin-1',
  displayName: '상담원',
  email: 'admin@example.com',
  role: 'operator',
  active: true,
};

describe('LocalChatRepository', () => {
  it('moves a bot conversation through handoff, claim, reply, resolve, and reopen', async () => {
    const repository = new LocalChatRepository(createStorage());
    const created = await repository.createVisitorConversation('coach-myway');

    await repository.appendMessage({
      conversationId: created.conversation.id,
      clientId: 'visitor-1',
      sender: 'visitor',
      text: '상담하고 싶어요.',
    });
    await repository.appendMessage({
      conversationId: created.conversation.id,
      clientId: 'bot-1',
      sender: 'bot',
      text: '상담원에게 연결해 드릴게요.',
      metadata: { handoffCta: true },
    });
    await repository.requestHandoff(
      created.conversation.id,
      {
        name: '홍길동',
        contact: '010-0000-0000',
        privacyAgreedAt: '2026-07-30T00:00:00.000Z',
      },
      'manualContact',
    );
    expect((await repository.loadConversation(created.conversation.id))?.conversation.status).toBe('waiting');

    await repository.claimConversation(created.conversation.id, admin);
    await repository.appendMessage({
      conversationId: created.conversation.id,
      clientId: 'operator-1',
      sender: 'operator',
      senderId: admin.id,
      senderName: admin.displayName,
      text: '어떤 점이 궁금하신가요?',
    });
    const active = await repository.loadConversation(created.conversation.id);
    expect(active?.conversation.status).toBe('human_active');
    expect(active?.conversation.unreadForVisitor).toBe(1);

    await repository.resolveConversation(created.conversation.id);
    await repository.appendMessage({
      conversationId: created.conversation.id,
      clientId: 'visitor-2',
      sender: 'visitor',
      text: '추가 질문이 있어요.',
    });
    expect((await repository.loadConversation(created.conversation.id))?.conversation.status).toBe('human_active');
  });

  it('deduplicates retried messages by client id and blocks duplicate claims', async () => {
    const repository = new LocalChatRepository(createStorage());
    const created = await repository.createVisitorConversation('coach-myway');
    const first = await repository.appendMessage({
      conversationId: created.conversation.id,
      clientId: 'retry-safe',
      sender: 'visitor',
      text: '첫 메시지',
    });
    const retried = await repository.appendMessage({
      conversationId: created.conversation.id,
      clientId: 'retry-safe',
      sender: 'visitor',
      text: '중복 메시지',
    });
    expect(retried.id).toBe(first.id);
    expect((await repository.loadConversation(created.conversation.id))?.messages).toHaveLength(1);

    await repository.requestHandoff(
      created.conversation.id,
      { name: '고객', contact: 'contact', privacyAgreedAt: new Date().toISOString() },
      'fallback',
    );
    await repository.claimConversation(created.conversation.id, admin);
    await expect(repository.claimConversation(created.conversation.id, {
      ...admin,
      id: 'admin-2',
      displayName: '다른 상담원',
    })).rejects.toThrow('이미 담당 중');
  });

  it('stores internal notes separately from customer-visible messages', async () => {
    const repository = new LocalChatRepository(createStorage());
    const created = await repository.createVisitorConversation('coach-myway');
    await repository.appendInternalNote(created.conversation.id, admin, '내부 확인 필요');

    expect(await repository.listInternalNotes(created.conversation.id)).toMatchObject([
      { authorName: '상담원', text: '내부 확인 필요' },
    ]);
    expect((await repository.loadConversation(created.conversation.id))?.messages).toHaveLength(0);
  });
});
