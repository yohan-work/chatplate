import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import {
  COACH_MYWAY_AUDIT_CASE_COUNT,
  coachMywayAuditCases,
  validateCoachMywayAuditCases,
} from '../data/coachMywayAuditCorpus';
import { buildSearchIndex } from '../engine/buildSearchIndex';
import { normalizeText } from '../engine/normalizeText';
import { auditConversationCase, buildLegacyAuditCases } from './auditConversation';
import { createConversationAudit, renderConversationAuditMarkdown } from './conversationAuditReport';

const config = botConfigs['coach-myway'];
const fullAudit = createConversationAudit(config);

describe('conversation accuracy and suitability audit', () => {
  it('keeps the challenge set isolated, complete, and structurally valid', () => {
    expect(coachMywayAuditCases).toHaveLength(COACH_MYWAY_AUDIT_CASE_COUNT);
    expect(buildLegacyAuditCases()).toHaveLength(240);
    expect(validateCoachMywayAuditCases(new Set(config.knowledge.map((item) => item.id)))).toEqual([]);
    expect(new Set(coachMywayAuditCases.map((entry) => entry.id))).toHaveLength(COACH_MYWAY_AUDIT_CASE_COUNT);
    const indexedUtterances = new Set(buildSearchIndex(config).flatMap((entry) => entry.utterances));
    const leakedQueries = coachMywayAuditCases
      .filter((entry) => indexedUtterances.has(normalizeText(entry.query)))
      .map((entry) => entry.id);
    expect(leakedQueries).toEqual([]);
  });

  it('creates deterministic decision traces without changing production behavior', () => {
    const entry = coachMywayAuditCases.find((item) => item.id === 'audit-ambiguous-timing');
    expect(entry).toBeDefined();
    const first = auditConversationCase(entry!, config, 'candidate');
    const second = auditConversationCase(entry!, config, 'candidate');
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      caseId: 'audit-ambiguous-timing',
      normalizedQuery: '시간은 어떻게 잡아요',
    });
    expect(first.candidates.every((candidate) => candidate.question && candidate.sourceStatus)).toBe(true);
  });

  it('audits 400 turns across both variants and all 70 answers', () => {
    const result = fullAudit;
    expect(result.cases).toHaveLength(400);
    expect(result.records).toHaveLength(800);
    expect(result.knowledgeAudits).toHaveLength(70);
    expect(result.summary.byCategory).toEqual({
      'faq-coverage': 150,
      robustness: 60,
      contrast: 20,
      ambiguous: 40,
      context: 70,
      unsupported: 26,
      safety: 34,
    });
  }, 20_000);

  it('keeps ambiguity explicit, uses question-specific answers, and calibrates answer trust', () => {
    const result = fullAudit;
    const findings = new Map(result.summary.priorityFindings.map((finding) => [finding.code, finding]));
    expect(findings.has('wrong-route')).toBe(false);
    expect(findings.has('wrong-retrieval')).toBe(false);
    expect(findings.has('generic-answer')).toBe(false);
    expect(findings.has('source-confidence-mismatch')).toBe(false);
    expect(result.summary.candidate.calibrationFailures).toBe(0);
    expect(result.summary.knowledge).toMatchObject({
      known: 24,
      draftSafe: 46,
      unverifiable: 46,
      direct: 70,
      genericOrDeflective: 0,
    });
    expect(renderConversationAuditMarkdown(result)).toContain('Candidate 실패 trace');
  }, 20_000);
});
