import { describe, expect, it } from 'vitest';
import type { SupportConversation } from '../types/chatbot';
import {
  formatSupportHours,
  getConversationSlaState,
  validateSupportSchedule,
  type SupportSchedule,
} from './supportOperations';

const schedule: SupportSchedule = {
  timezone: 'Asia/Seoul',
  weekly: {
    mon: [{ start: '10:00', end: '18:00' }],
    tue: [{ start: '10:00', end: '18:00' }],
    wed: [{ start: '10:00', end: '18:00' }],
    thu: [{ start: '10:00', end: '18:00' }],
    fri: [{ start: '10:00', end: '18:00' }],
  },
  holidays: [],
  firstResponseTargetMinutes: 240,
};

function conversation(patch: Partial<SupportConversation>): SupportConversation {
  return {
    id: 'conversation-1',
    botId: 'coach-myway',
    visitorId: 'visitor-1',
    status: 'waiting',
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
    lastMessageAt: '2026-07-31T00:00:00.000Z',
    unreadForVisitor: 0,
    unreadForAdmins: 0,
    ...patch,
  };
}

describe('support schedule operations', () => {
  it('groups consecutive weekdays in the customer-facing hours', () => {
    expect(validateSupportSchedule(schedule)).toEqual([]);
    expect(formatSupportHours(schedule))
      .toBe('월~금 10:00~18:00, 상담 요청 후 운영시간 기준 4시간 이내 답변');
  });

  it('rejects empty, reversed, overlapping, and malformed schedule values', () => {
    expect(validateSupportSchedule({
      timezone: 'UTC',
      weekly: {
        mon: [
          { start: '11:00', end: '10:00' },
          { start: '09:00', end: '12:00' },
          { start: '11:30', end: '13:00' },
        ],
      },
      holidays: ['not-a-date', '2026-02-31'],
      firstResponseTargetMinutes: 0,
    })).toEqual(expect.arrayContaining([
      expect.stringContaining('Asia/Seoul'),
      expect.stringContaining('최초 답변 목표'),
      expect.stringContaining('종료 시간'),
      expect.stringContaining('겹칩니다'),
      expect.stringContaining('휴무일'),
    ]));
    expect(validateSupportSchedule({ ...schedule, weekly: {} }))
      .toContain('최소 한 개의 운영시간을 등록해야 합니다.');
  });
});

describe('conversation SLA state', () => {
  const dueAt = '2026-07-31T04:00:00.000Z';

  it('separates on-track, due-soon, and overdue conversations', () => {
    expect(getConversationSlaState(conversation({ firstResponseDueAt: dueAt }), new Date('2026-07-31T02:00:00.000Z')).kind)
      .toBe('onTrack');
    expect(getConversationSlaState(conversation({ firstResponseDueAt: dueAt }), new Date('2026-07-31T03:00:00.000Z')))
      .toMatchObject({ kind: 'dueSoon', label: '60분 남음' });
    expect(getConversationSlaState(conversation({ firstResponseDueAt: dueAt }), new Date('2026-07-31T04:30:00.000Z')))
      .toMatchObject({ kind: 'overdue', label: '30분 초과' });
  });

  it('classifies completed first responses against the target', () => {
    expect(getConversationSlaState(conversation({
      firstResponseDueAt: dueAt,
      firstRespondedAt: '2026-07-31T03:59:00.000Z',
    })).kind).toBe('respondedOnTime');
    expect(getConversationSlaState(conversation({
      firstResponseDueAt: dueAt,
      firstRespondedAt: '2026-07-31T04:01:00.000Z',
    })).kind).toBe('respondedLate');
  });
});
