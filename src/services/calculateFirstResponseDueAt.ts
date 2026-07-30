import type { OperationInfo } from '../types/chatbot';

const WEEKDAY_MAP: Record<string, keyof NonNullable<OperationInfo['supportSchedule']>['weekly']> = {
  Sun: 'sun',
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
};

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: WEEKDAY_MAP[value('weekday')],
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minute: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

function minuteOfDay(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function calculateFirstResponseDueAt(
  operation: OperationInfo,
  from = new Date(),
): string {
  const schedule = operation.supportSchedule;
  if (!schedule) return new Date(from.getTime() + 4 * 60 * 60 * 1000).toISOString();
  const holidays = new Set(schedule.holidays);
  let remaining = Math.max(1, schedule.firstResponseTargetMinutes);
  let cursor = new Date(from);
  const maximumMinutes = 60 * 24 * 60;
  for (let index = 0; index < maximumMinutes; index += 1) {
    cursor = new Date(cursor.getTime() + 60_000);
    const parts = zonedParts(cursor, schedule.timezone);
    const ranges = schedule.weekly[parts.weekday] ?? [];
    const isOpen = !holidays.has(parts.date) && ranges.some((range) =>
      parts.minute >= minuteOfDay(range.start) && parts.minute < minuteOfDay(range.end),
    );
    if (isOpen) remaining -= 1;
    if (remaining === 0) return cursor.toISOString();
  }
  throw new Error('60일 안에 상담 운영시간을 찾지 못했습니다.');
}
