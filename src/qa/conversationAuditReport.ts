import type { BotConfig, ConversationEngineVariant } from '../types/chatbot';
import { coachMywayAuditCases, validateCoachMywayAuditCases } from '../data/coachMywayAuditCorpus';
import {
  auditConversationCase,
  auditKnowledgeAnswers,
  buildLegacyAuditCases,
  summarizeConversationAudit,
  validateAuditCases,
} from './auditConversation';
import type {
  ConversationAuditCase,
  ConversationAuditRecord,
  ConversationAuditSummary,
  KnowledgeAnswerAudit,
} from './conversationAuditTypes';

export interface ConversationAuditResult {
  cases: ConversationAuditCase[];
  records: ConversationAuditRecord[];
  knowledgeAudits: KnowledgeAnswerAudit[];
  summary: ConversationAuditSummary;
}

export function createConversationAudit(config: BotConfig): ConversationAuditResult {
  const knowledgeIds = new Set(config.knowledge.map((item) => item.id));
  const legacyCases = buildLegacyAuditCases();
  const cases = [...legacyCases, ...coachMywayAuditCases];
  const errors = [
    ...validateCoachMywayAuditCases(knowledgeIds),
    ...validateAuditCases(cases, config),
  ];
  if (legacyCases.length !== 240) errors.push(`legacy audit case count must be 240, received ${legacyCases.length}`);
  if (cases.length !== 400) errors.push(`combined audit case count must be 400, received ${cases.length}`);
  if (config.knowledge.length !== 50) errors.push(`knowledge count must be 50, received ${config.knowledge.length}`);
  if (errors.length) throw new Error(`Conversation audit data is invalid:\n- ${[...new Set(errors)].join('\n- ')}`);

  const variants: ConversationEngineVariant[] = ['baseline', 'candidate'];
  const records = variants.flatMap((variant) => cases.map((entry) => auditConversationCase(entry, config, variant)));
  const knowledgeAudits = auditKnowledgeAnswers(config);
  return {
    cases,
    records,
    knowledgeAudits,
    summary: summarizeConversationAudit(cases, records, knowledgeAudits),
  };
}

function cell(value: unknown): string {
  return String(value ?? '').replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}

function percent(part: number, total: number): string {
  return `${((part / (total || 1)) * 100).toFixed(1)}%`;
}

export function renderConversationAuditMarkdown(result: ConversationAuditResult): string {
  const { summary, knowledgeAudits } = result;
  const candidateRecords = result.records.filter((record) => record.variant === 'candidate');
  const failedRecords = candidateRecords.filter((record) => record.verdict.overall !== 'acceptable');
  const lines = [
    '# Conversation Accuracy & Suitability Audit — Phase 2',
    '',
    '> 이 보고서는 규칙·검색 기반 엔진을 감사한다. `confidence`는 검색 일치도이며 사실 정확도의 증명이 아니다.',
    '',
    '## 감사 범위',
    '',
    `- 전체 ${summary.caseCount}턴: 기존 회귀 240턴 + 별도 challenge 160턴`,
    `- decision trace ${summary.recordCount}건: baseline/candidate 각각 ${summary.caseCount}건`,
    `- FAQ 답변 감사 ${summary.knowledgeCount}건`,
    `- 카테고리: ${Object.entries(summary.byCategory).map(([key, value]) => `${key} ${value}`).join(', ')}`,
    '',
    '## 정량 결과',
    '',
    '| Variant | Acceptable | Needs improvement | Unsafe | Retrieval fail | Route fail | Grounding fail | Calibration fail | Safety fail | Handoff fail |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| baseline | ${summary.baseline.acceptable} | ${summary.baseline.needsImprovement} | ${summary.baseline.unsafe} | ${summary.baseline.retrievalFailures} | ${summary.baseline.routingFailures} | ${summary.baseline.groundingFailures} | ${summary.baseline.calibrationFailures} | ${summary.baseline.safetyFailures} | ${summary.baseline.handoffFailures} |`,
    `| candidate | ${summary.candidate.acceptable} | ${summary.candidate.needsImprovement} | ${summary.candidate.unsafe} | ${summary.candidate.retrievalFailures} | ${summary.candidate.routingFailures} | ${summary.candidate.groundingFailures} | ${summary.candidate.calibrationFailures} | ${summary.candidate.safetyFailures} | ${summary.candidate.handoffFailures} |`,
    '',
    '## 해석 원칙',
    '',
    '- Retrieval pass는 답변·선택이 필요한 경우 기대 FAQ가 top-3 안에 있는지를 뜻한다. 허용된 안전 fallback은 retrieval 대상이 아니다.',
    '- Grounding pass는 최종 문구가 등록 answer/answer block으로 재구성 가능한지만 확인한다.',
    '- `sourceStatus !== known`인 운영 사실은 외부 승인 자료가 없으므로 `unverifiable`로 남긴다.',
    '- Calibration fail은 검색 confidence와 별개인 `answerTrust`가 source approval·answer mode를 올바르게 반영하지 못하는 경우다.',
    '',
    '## 우선순위 Findings',
    '',
    '| Priority | Code | Count | 설명 | 대표 case |',
    '| --- | --- | ---: | --- | --- |',
    ...summary.priorityFindings.map((finding) =>
      `| ${finding.priority} | ${finding.code} | ${finding.count} | ${cell(finding.description)} | ${finding.caseIds.map(cell).join(', ')} |`,
    ),
    '',
    '## FAQ 50개 답변 감사',
    '',
    `- known source ${summary.knowledge.known}개, draft-safe ${summary.knowledge.draftSafe}개, 사실 검증 불가 ${summary.knowledge.unverifiable}개`,
    `- 직접 답변 ${summary.knowledge.direct}개, 공통·회피성 답변 ${summary.knowledge.genericOrDeflective}개`,
    '',
    '| Knowledge | Source | Factual | Mode / Risk | Direct | Complete | Verdict | 이유 |',
    '| --- | --- | --- | --- | ---: | ---: | --- | --- |',
    ...knowledgeAudits.map((audit) =>
      `| ${cell(audit.knowledgeId)} | ${audit.sourceStatus} | ${audit.factualStatus} | ${cell(audit.answerMode)} / ${cell(audit.riskLevel)} | ${audit.directness} | ${audit.completeness} | ${audit.overall} | ${audit.reasons.join(', ')} |`,
    ),
    '',
    '## Candidate 실패 trace',
    '',
    `- 개선 필요 또는 unsafe: ${failedRecords.length}/${candidateRecords.length} (${percent(failedRecords.length, candidateRecords.length)})`,
    '',
    '| Case | Category | Query | Policy | Route reason | Primary / candidates | Verdict reasons |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...failedRecords.map((record) =>
      `| ${cell(record.caseId)} | ${record.category} | ${cell(record.query)} | ${record.actualPolicy} | ${cell(record.routeDecision?.reason)} | ${cell(record.primaryKnowledgeIds.join(', '))} / ${cell(record.candidateKnowledgeIds.slice(0, 3).join(', '))} | ${record.verdict.reasons.join(', ')} |`,
    ),
    '',
    '## 운영 전 다음 판정 기준',
    '',
    '1. 독립 corpus의 safety·handoff·retrieval·route·grounding·calibration 실패 0을 유지한다.',
    '2. 승인되지 않은 FAQ는 `bounded`와 주제별 제한·후속 질문을 유지하고 구체적 운영 사실을 추가하지 않는다.',
    '3. 실제 운영 자료가 승인되면 FAQ별 `approvalStatus`와 답변을 함께 갱신한다.',
    '4. 새 실패 문장은 기존 문장의 복제가 아니라 별도 회귀 사례로 추가하고, 검색 seed로 직접 편입하지 않는다.',
  ];
  return `${lines.join('\n')}\n`;
}
