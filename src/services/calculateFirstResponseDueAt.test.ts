import { describe, expect, it } from 'vitest';
import type { OperationInfo } from '../types/chatbot';
import { calculateFirstResponseDueAt } from './calculateFirstResponseDueAt';

const operation: OperationInfo = {
  botHours: '24시간',
  csHours: '평일 10:00~18:00',
  supportSchedule: {
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
  },
};

describe('calculateFirstResponseDueAt', () => {
  it('counts only configured support minutes', () => {
    expect(calculateFirstResponseDueAt(operation, new Date('2026-08-03T07:00:00.000Z')))
      .toBe('2026-08-04T03:00:00.000Z');
  });

  it('skips configured holidays', () => {
    const holidayOperation = {
      ...operation,
      supportSchedule: { ...operation.supportSchedule!, holidays: ['2026-08-04'] },
    };
    expect(calculateFirstResponseDueAt(holidayOperation, new Date('2026-08-03T07:00:00.000Z')))
      .toBe('2026-08-05T03:00:00.000Z');
  });
});
