import type { BlindReviewSummary } from './conversationParityReview';
import type { ParityTrace } from './conversationParityTypes';
import { summarizeParityTraces, type ParityMetricSummary } from './evaluateConversationParity';

export interface ConversationParityReport {
  summaries: ParityMetricSummary[];
  failures: Array<{ engine: string; scenarioId: string; turnId: string; query: string; reasons: string[] }>;
  blind?: BlindReviewSummary;
  verdict: 'llm-equivalent' | 'partially-equivalent' | 'below-target' | 'insufficient-evidence';
  reasons: string[];
}

export function createConversationParityReport(
  traces: ParityTrace[],
  blind?: BlindReviewSummary,
): ConversationParityReport {
  const summaries = [...new Set(traces.map((trace) => trace.engine))]
    .map((engine) => summarizeParityTraces(traces.filter((trace) => trace.engine === engine)));
  const failures = [...new Set(traces.map((trace) => trace.engine))].flatMap((engine) => traces
    .filter((trace) => trace.engine === engine)
    .flatMap((trace) => trace.turns
      .filter((turn) => turn.verdict.reasons.length)
      .map((turn) => ({
        engine: trace.engine,
        scenarioId: trace.scenarioId,
        turnId: turn.turn.id,
        query: turn.turn.query,
        reasons: turn.verdict.reasons,
      })))
    .slice(0, 20));
  const candidate = summaries.find((summary) => summary.engine === 'candidate');
  const llm = summaries.find((summary) => summary.engine === 'llm');
  const reasons: string[] = [];
  if (!candidate) reasons.push('candidate traces missing');
  if (!llm) reasons.push('LLM fixtures missing');
  if (!blind?.complete) reasons.push('120-item two-reviewer blind evaluation incomplete');
  if (candidate?.hardGateFailures) reasons.push(`candidate hard-gate failures: ${candidate.hardGateFailures}`);
  if (blind && !blind.passesAgreement) reasons.push(`reviewer agreement below 0.6: ${blind.preferenceKappa.toFixed(3)}`);
  if (blind && !blind.passesPreference) reasons.push(`candidate preference score below 40%: ${(blind.candidatePreferenceScore * 100).toFixed(1)}%`);
  if (blind && !blind.passesQualityNonInferiority) reasons.push('quality non-inferiority lower bound is not above -10%p');
  if (candidate && llm && candidate.resolutionRate < llm.resolutionRate - 0.1) {
    reasons.push(`candidate resolution is more than 10%p below LLM: ${((candidate.resolutionRate - llm.resolutionRate) * 100).toFixed(1)}%p`);
  }
  let verdict: ConversationParityReport['verdict'] = 'insufficient-evidence';
  if (candidate && llm && blind?.complete) {
    const hardPass = candidate.hardGateFailures === 0;
    const resolutionPass = candidate.resolutionRate >= llm.resolutionRate - 0.1;
    const qualityPass = blind.passesAgreement && blind.passesPreference && blind.passesQualityNonInferiority;
    verdict = hardPass && resolutionPass && qualityPass
      ? 'llm-equivalent'
      : hardPass && (resolutionPass || qualityPass)
        ? 'partially-equivalent'
        : 'below-target';
  }
  return { summaries, failures, blind, verdict, reasons };
}

export function renderConversationParityMarkdown(report: ConversationParityReport): string {
  const lines = [
    '# Coach My:Way — Domain Conversation LLM Parity',
    '',
    `- 판정: **${report.verdict}**`,
    `- 근거 부족 또는 실패 사유: ${report.reasons.length ? report.reasons.join('; ') : '없음'}`,
    '',
    '## 자동 평가',
    '',
    '| Engine | Scenarios | Turns | Resolution | Hard gate fail | Policy fail | Retrieval fail | Handoff fail | Correction fail |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.summaries.map((summary) =>
      `| ${summary.engine} | ${summary.scenarioCount} | ${summary.turnCount} | ${(summary.resolutionRate * 100).toFixed(1)}% | ${summary.hardGateFailures} | ${summary.policyFailures} | ${summary.retrievalFailures} | ${summary.handoffFailures} | ${summary.correctionFailures} |`,
    ),
    '',
    '## 카테고리별 해결률',
    '',
    '| Engine | Paraphrase | Ambiguity | Context/correction | Compound | Emotion | Safety | Boundary |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.summaries.map((summary) => `| ${summary.engine} | ${[
      'paraphrase', 'ambiguity', 'context-correction', 'compound', 'emotion', 'safety', 'boundary',
    ].map((category) => `${(summary.byCategory[category as keyof typeof summary.byCategory].resolutionRate * 100).toFixed(1)}%`).join(' | ')} |`),
  ];
  if (report.blind) {
    lines.push(
      '',
      '## 사람 블라인드 평가',
      '',
      `- 완료 표본: ${report.blind.itemCount}/120`,
      `- 미판정 선호 불일치: ${report.blind.unresolvedPreferenceDisagreements}건`,
      `- 평가자 선호 κ: ${report.blind.preferenceKappa.toFixed(3)}`,
      `- Candidate 선호 점수: ${(report.blind.candidatePreferenceScore * 100).toFixed(1)}%`,
      `- 품질 차이 Candidate−LLM: ${(report.blind.qualityDelta * 100).toFixed(1)}%p`,
      `- 95% CI: ${(report.blind.qualityDeltaCi95[0] * 100).toFixed(1)}%p ~ ${(report.blind.qualityDeltaCi95[1] * 100).toFixed(1)}%p`,
    );
  }
  lines.push(
    '',
    '## 대표 실패 trace',
    '',
    '| Engine | Scenario | Turn | Query | Reasons |',
    '| --- | --- | --- | --- | --- |',
    ...report.failures.map((failure) =>
      `| ${failure.engine} | ${failure.scenarioId} | ${failure.turnId} | ${failure.query.replace(/\|/gu, '\\|')} | ${failure.reasons.join(', ')} |`,
    ),
  );
  return `${lines.join('\n')}\n`;
}
