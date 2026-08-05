import type { BotConfig, KnowledgeApprovalStatus, KnowledgeItem } from '../types/chatbot';

export type KnowledgeApprovalIssueCode =
  | 'missing-source'
  | 'missing-reviewer'
  | 'missing-reviewed-at'
  | 'missing-next-review-at'
  | 'invalid-reviewed-at'
  | 'invalid-next-review-at'
  | 'expired'
  | 'unsafe-verified-mode';

export interface KnowledgeApprovalIssue {
  code: KnowledgeApprovalIssueCode;
  message: string;
  blocking: boolean;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

function validDate(value: string | undefined): boolean {
  return Boolean(value && DATE_ONLY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

export function approvalStatusOfRecord(item: Pick<KnowledgeItem, 'approvalStatus' | 'source'>): KnowledgeApprovalStatus {
  if (item.approvalStatus) return item.approvalStatus;
  if (!item.source?.trim()) return 'unknown';
  if (/(?:승인.*(?:대기|전)|수령 전)/u.test(item.source)) return 'pending';
  return 'verified';
}

export function requiresScheduledReview(item: Pick<KnowledgeItem, 'id' | 'intentId' | 'categoryId'>): boolean {
  return item.id === 'hours-001' || item.intentId === 'pricing' || item.intentId === 'policy';
}

export function isApprovalExpired(
  item: Pick<KnowledgeItem, 'nextReviewAt'>,
  now: Date = new Date(),
): boolean {
  if (!item.nextReviewAt || !validDate(item.nextReviewAt)) return false;
  const endOfReviewDay = Date.parse(`${item.nextReviewAt}T23:59:59.999Z`);
  return endOfReviewDay < now.getTime();
}

export function knowledgeApprovalIssues(item: KnowledgeItem, now: Date = new Date()): KnowledgeApprovalIssue[] {
  if (approvalStatusOfRecord(item) !== 'verified') return [];
  const issues: KnowledgeApprovalIssue[] = [];
  if (!item.source?.trim()) issues.push({ code: 'missing-source', message: '확정 답변에는 출처가 필요합니다.', blocking: true });
  if (!item.reviewedBy?.trim()) issues.push({ code: 'missing-reviewer', message: '확정 답변에는 검토자가 필요합니다.', blocking: true });
  if (!item.reviewedAt?.trim()) issues.push({ code: 'missing-reviewed-at', message: '확정 답변에는 검토일이 필요합니다.', blocking: true });
  else if (!validDate(item.reviewedAt)) issues.push({ code: 'invalid-reviewed-at', message: '검토일은 YYYY-MM-DD 형식이어야 합니다.', blocking: true });
  if (requiresScheduledReview(item) && !item.nextReviewAt?.trim()) {
    issues.push({ code: 'missing-next-review-at', message: '변경 가능한 운영 정보에는 재검토일이 필요합니다.', blocking: true });
  } else if (item.nextReviewAt && !validDate(item.nextReviewAt)) {
    issues.push({ code: 'invalid-next-review-at', message: '재검토일은 YYYY-MM-DD 형식이어야 합니다.', blocking: true });
  } else if (isApprovalExpired(item, now)) {
    issues.push({ code: 'expired', message: '재검토일이 지나 확정 답변으로 배포할 수 없습니다.', blocking: true });
  }
  if ((item.riskLevel === 'policy' || item.riskLevel === 'personal') && item.answerMode === 'verified' && !item.handoffRecommended) {
    issues.push({ code: 'unsafe-verified-mode', message: '정책·개인 판단 FAQ는 제한 안내 또는 상담 연결이 필요합니다.', blocking: true });
  }
  return issues;
}

export function botConfigApprovalErrors(config: BotConfig, now: Date = new Date()): string[] {
  if (config.bot.id !== 'coach-myway') return [];
  return config.knowledge.flatMap((item) => knowledgeApprovalIssues(item, now)
    .filter((issue) => issue.blocking)
    .map((issue) => `${item.id}: ${issue.message}`));
}
