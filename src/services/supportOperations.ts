import type { OperationInfo, SupportConversation } from '../types/chatbot';

export const SUPPORT_WEEKDAYS = [
  { id: 'mon', label: '월' },
  { id: 'tue', label: '화' },
  { id: 'wed', label: '수' },
  { id: 'thu', label: '목' },
  { id: 'fri', label: '금' },
  { id: 'sat', label: '토' },
  { id: 'sun', label: '일' },
] as const;

export type SupportWeekday = (typeof SUPPORT_WEEKDAYS)[number]['id'];
export type SupportSchedule = NonNullable<OperationInfo['supportSchedule']>;
export type ConversationSlaKind =
  | 'none'
  | 'onTrack'
  | 'dueSoon'
  | 'overdue'
  | 'respondedOnTime'
  | 'respondedLate';

export interface ConversationSlaState {
  kind: ConversationSlaKind;
  label: string;
  dueAt?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function minuteOfDay(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function formatTargetMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  return `${minutes}분`;
}

function formatDueTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function validateSupportSchedule(schedule: SupportSchedule): string[] {
  const errors: string[] = [];
  let rangeCount = 0;

  if (schedule.timezone !== 'Asia/Seoul') {
    errors.push('현재 운영 timezone은 Asia/Seoul만 지원합니다.');
  }
  if (!Number.isInteger(schedule.firstResponseTargetMinutes) ||
      schedule.firstResponseTargetMinutes < 1 ||
      schedule.firstResponseTargetMinutes > 10_080) {
    errors.push('최초 답변 목표는 1~10,080분 사이의 정수여야 합니다.');
  }

  for (const weekday of SUPPORT_WEEKDAYS) {
    const ranges = schedule.weekly[weekday.id] ?? [];
    rangeCount += ranges.length;
    const normalized: Array<{ start: number; end: number }> = [];
    for (const range of ranges) {
      if (!TIME_PATTERN.test(range.start) || !TIME_PATTERN.test(range.end)) {
        errors.push(`${weekday.label}요일 운영시간은 HH:mm 형식이어야 합니다.`);
        continue;
      }
      const start = minuteOfDay(range.start);
      const end = minuteOfDay(range.end);
      if (start >= end) {
        errors.push(`${weekday.label}요일 종료 시간은 시작 시간보다 늦어야 합니다.`);
        continue;
      }
      normalized.push({ start, end });
    }
    normalized.sort((left, right) => left.start - right.start);
    for (let index = 1; index < normalized.length; index += 1) {
      if (normalized[index].start < normalized[index - 1].end) {
        errors.push(`${weekday.label}요일 운영시간이 서로 겹칩니다.`);
        break;
      }
    }
  }

  if (rangeCount === 0) errors.push('최소 한 개의 운영시간을 등록해야 합니다.');
  for (const holiday of schedule.holidays) {
    const parsed = new Date(`${holiday}T00:00:00Z`);
    if (!DATE_PATTERN.test(holiday) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== holiday) {
      errors.push(`휴무일 형식이 올바르지 않습니다: ${holiday}`);
    }
  }
  return [...new Set(errors)];
}

export function formatSupportHours(schedule: SupportSchedule): string {
  const groups: Array<{ start: number; end: number; signature: string }> = [];
  for (let index = 0; index < SUPPORT_WEEKDAYS.length; index += 1) {
    const weekday = SUPPORT_WEEKDAYS[index];
    const signature = (schedule.weekly[weekday.id] ?? [])
      .map((range) => `${range.start}~${range.end}`)
      .join(', ');
    if (!signature) continue;
    const previous = groups.at(-1);
    if (previous && previous.end === index - 1 && previous.signature === signature) {
      previous.end = index;
    } else {
      groups.push({ start: index, end: index, signature });
    }
  }

  const hours = groups.map((group) => {
    const day = group.start === group.end
      ? SUPPORT_WEEKDAYS[group.start].label
      : `${SUPPORT_WEEKDAYS[group.start].label}~${SUPPORT_WEEKDAYS[group.end].label}`;
    return `${day} ${group.signature}`;
  }).join(' · ');
  const holiday = schedule.holidays.length ? ' · 지정 휴무일 제외' : '';
  return `${hours}${holiday}, 상담 요청 후 운영시간 기준 ${formatTargetMinutes(schedule.firstResponseTargetMinutes)} 이내 답변`;
}

export function getConversationSlaState(
  conversation: Pick<SupportConversation, 'firstResponseDueAt' | 'firstRespondedAt'>,
  referenceDate = new Date(),
): ConversationSlaState {
  const dueAt = conversation.firstResponseDueAt;
  if (!dueAt) return { kind: 'none', label: '응답 목표 없음' };
  const dueTime = new Date(dueAt).getTime();
  if (!Number.isFinite(dueTime)) return { kind: 'none', label: '응답 목표 오류' };

  if (conversation.firstRespondedAt) {
    const respondedTime = new Date(conversation.firstRespondedAt).getTime();
    const onTime = respondedTime <= dueTime;
    return {
      kind: onTime ? 'respondedOnTime' : 'respondedLate',
      label: onTime ? '첫 답변 완료' : '첫 답변 지연',
      dueAt,
    };
  }

  const remainingMinutes = Math.ceil((dueTime - referenceDate.getTime()) / 60_000);
  if (remainingMinutes <= 0) {
    return {
      kind: 'overdue',
      label: `${Math.max(1, Math.ceil((referenceDate.getTime() - dueTime) / 60_000))}분 초과`,
      dueAt,
    };
  }
  if (remainingMinutes <= 60) {
    return { kind: 'dueSoon', label: `${remainingMinutes}분 남음`, dueAt };
  }
  return { kind: 'onTrack', label: `${formatDueTime(dueAt)}까지`, dueAt };
}
