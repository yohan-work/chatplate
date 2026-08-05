import type { AnswerTrust, KnowledgeApprovalStatus, KnowledgeItem } from '../types/chatbot';
import { approvalStatusOfRecord, isApprovalExpired, knowledgeApprovalIssues } from './knowledgeApproval';

export function approvalStatusOf(item: Pick<KnowledgeItem, 'approvalStatus' | 'source'>): KnowledgeApprovalStatus {
  return approvalStatusOfRecord(item);
}

export function answerTrustFor(item: KnowledgeItem, now: Date = new Date()): AnswerTrust {
  const approvalStatus = approvalStatusOf(item);
  const invalidApproval = knowledgeApprovalIssues(item, now).some((issue) => issue.blocking);
  if (approvalStatus === 'verified' && !invalidApproval && !isApprovalExpired(item, now) && item.answerMode === 'verified' && (item.riskLevel ?? 'low') === 'low') {
    return 'verified';
  }
  if (approvalStatus === 'pending' || approvalStatus === 'verified' || item.answerMode === 'safe-general' || item.answerMode === 'handoff' || item.riskLevel !== 'low') {
    return 'bounded';
  }
  return 'unverified';
}

export function combinedAnswerTrust(items: KnowledgeItem[]): AnswerTrust {
  const trusts = items.map((item) => answerTrustFor(item));
  if (trusts.includes('unverified')) return 'unverified';
  if (trusts.includes('bounded')) return 'bounded';
  return 'verified';
}
