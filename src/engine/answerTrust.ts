import type { AnswerTrust, KnowledgeApprovalStatus, KnowledgeItem } from '../types/chatbot';

export function approvalStatusOf(item: Pick<KnowledgeItem, 'approvalStatus' | 'source'>): KnowledgeApprovalStatus {
  if (item.approvalStatus) return item.approvalStatus;
  if (!item.source?.trim()) return 'unknown';
  if (/(?:승인.*(?:대기|전)|수령 전)/u.test(item.source)) return 'pending';
  return 'verified';
}

export function answerTrustFor(item: KnowledgeItem): AnswerTrust {
  const approvalStatus = approvalStatusOf(item);
  if (approvalStatus === 'verified' && item.answerMode === 'verified' && (item.riskLevel ?? 'low') === 'low') {
    return 'verified';
  }
  if (approvalStatus === 'pending' || item.answerMode === 'safe-general' || item.answerMode === 'handoff' || item.riskLevel !== 'low') {
    return 'bounded';
  }
  return 'unverified';
}

export function combinedAnswerTrust(items: KnowledgeItem[]): AnswerTrust {
  const trusts = items.map(answerTrustFor);
  if (trusts.includes('unverified')) return 'unverified';
  if (trusts.includes('bounded')) return 'bounded';
  return 'verified';
}
