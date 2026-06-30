import { describe, expect, it } from 'vitest';
import { appendTicket, loadTickets, ticketsToCsv, updateTicket, validateTicketInput } from './ticketStorage';

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  };
}

describe('ticketStorage', () => {
  it('validates required fields', () => {
    expect(validateTicketInput({ botId: 'bot', source: 'fallback', name: '', contact: '', message: '' }).ok).toBe(false);
  });

  it('creates and updates tickets', () => {
    const storage = createStorage();
    const ticket = appendTicket({ botId: 'bot', source: 'fallback', name: 'Yohan', contact: 'me@example.com', message: '문의' }, storage);
    updateTicket(ticket.id, { status: 'inProgress', adminMemo: '확인 중' }, storage);
    expect(loadTickets(storage)[0]).toMatchObject({ status: 'inProgress', adminMemo: '확인 중' });
  });

  it('converts tickets to csv', () => {
    const csv = ticketsToCsv([
      {
        id: 'T-1',
        botId: 'bot',
        status: 'new',
        priority: 'normal',
        source: 'fallback',
        name: 'Yohan',
        contact: 'me@example.com',
        message: '문의, 내용',
        matchedKnowledgeIds: ['k1'],
        adminMemo: '',
        createdAt: '2026-06-30T00:00:00.000Z',
        updatedAt: '2026-06-30T00:00:00.000Z',
      },
    ]);
    expect(csv).toContain('"문의, 내용"');
  });
});
