import { describe, expect, it, vi } from 'vitest';
import { botConfigs } from '../data/bots';
import {
  COACH_MYWAY_PARITY_SCENARIO_COUNT,
  COACH_MYWAY_PARITY_TURN_COUNT,
  coachMywayParityScenarios,
  validateCoachMywayParityCorpus,
} from '../data/coachMywayParityCorpus';
import { buildSearchIndex } from '../engine/buildSearchIndex';
import { normalizeText } from '../engine/normalizeText';
import { createParityFixture, validateParityFixture } from './conversationParityFixture';
import { createBlindRatingTemplate, createBlindReview, summarizeBlindRatings } from './conversationParityReview';
import type { ConversationParityScenario, ParityResponse, ParityTrace } from './conversationParityTypes';
import {
  createDeterministicResponder,
  evaluateParityResponder,
  verdictForTurn,
} from './evaluateConversationParity';
import { createOpenAiEvaluationResponder } from './openAiEvaluationResponder';
import { createOpenAiBlindJudge } from './openAiBlindJudge';

const config = botConfigs['coach-myway'];

function passingResponse(scenario: ConversationParityScenario, engine: 'candidate' | 'llm'): ParityTrace {
  return {
    scenarioId: scenario.id,
    category: scenario.category,
    split: scenario.split,
    engine,
    turns: scenario.turns.map((turn) => {
      const response: ParityResponse = {
        policy: turn.expectation.acceptedPolicies[0],
        knowledgeIds: turn.expectation.requiredKnowledgeIds ?? turn.expectation.acceptedKnowledgeIds ?? [],
        answerTrust: 'bounded',
        replyText: turn.expectation.requiresCorrectionAcknowledgement ? '정정하신 내용을 기준으로 이해했어요.' : '등록 안내를 기준으로 답변드려요.',
        handoff: Boolean(turn.expectation.requiresHandoff),
      };
      return { turn, response, verdict: verdictForTurn(turn, response, scenario.category) };
    }),
  };
}

describe('conversation LLM parity evaluation', () => {
  it('keeps 360 scenarios and 780 turns isolated from exact indexed utterances', () => {
    expect(coachMywayParityScenarios).toHaveLength(COACH_MYWAY_PARITY_SCENARIO_COUNT);
    expect(coachMywayParityScenarios.flatMap((scenario) => scenario.turns)).toHaveLength(COACH_MYWAY_PARITY_TURN_COUNT);
    expect(validateCoachMywayParityCorpus(new Set(config.knowledge.map((item) => item.id)))).toEqual([]);
    const indexed = new Set(buildSearchIndex(config).flatMap((entry) => entry.utterances));
    expect(coachMywayParityScenarios.flatMap((scenario) => scenario.turns)
      .filter((turn) => indexed.has(normalizeText(turn.query)))).toEqual([]);
    expect(coachMywayParityScenarios.filter((scenario) => scenario.split === 'holdout')).toHaveLength(144);
  });

  it('evaluates a deterministic multi-turn scenario without changing production state', async () => {
    const entry = coachMywayParityScenarios.find((scenario) => scenario.id === 'parity-context-grade-online-1')!;
    const [trace] = await evaluateParityResponder([entry], createDeterministicResponder(config, 'candidate'));
    expect(trace.turns).toHaveLength(4);
    expect(trace.turns[0].response.knowledgeIds).toContain('fit-008');
    expect(trace.engine).toBe('candidate');
  });

  it('uses sequential Responses API history and parses the structured result', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({
        output: [{ type: 'message', content: [{
          type: 'output_text',
          text: JSON.stringify({
            policy: 'answer',
            knowledgeIds: ['fit-008'],
            answerTrust: 'bounded',
            replyText: '등록된 안내 범위에서 답변드려요.',
            handoff: false,
          }),
        }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const responder = createOpenAiEvaluationResponder({ apiKey: 'test-key', config, fetcher });
    const entry: ConversationParityScenario = {
      id: 'mock-sequential',
      category: 'context-correction',
      split: 'diagnostic',
      turns: [
        { id: 't1', query: '중학생도 되나요?', expectation: { acceptedPolicies: ['answer'] } },
        { id: 't2', query: '온라인도요?', expectation: { acceptedPolicies: ['answer'] } },
      ],
    };
    const responses = await responder.respond(entry);
    expect(responses).toHaveLength(2);
    expect((calls[0].input as unknown[])).toHaveLength(1);
    expect((calls[1].input as unknown[])).toHaveLength(3);
    expect(calls[0]).toMatchObject({ model: 'gpt-5.6-sol', store: false, reasoning: { effort: 'medium' } });
  });

  it('creates a balanced 120-item blind review and calculates non-inferiority', () => {
    const traces = coachMywayParityScenarios.flatMap((entry) => [passingResponse(entry, 'candidate'), passingResponse(entry, 'llm')]);
    const review = createBlindReview(traces);
    expect(review.items).toHaveLength(120);
    const sides = Object.values(review.key).filter((entry) => entry.left === 'candidate').length;
    expect(sides).toBeGreaterThan(45);
    expect(sides).toBeLessThan(75);
    const ratings = [
      ...createBlindRatingTemplate(review.items, 'reviewer-1'),
      ...createBlindRatingTemplate(review.items, 'reviewer-2'),
    ].map((rating) => ({ ...rating, completed: true }));
    const summary = summarizeBlindRatings(ratings, review.key);
    expect(summary).toMatchObject({
      complete: true,
      itemCount: 120,
      preferenceKappa: 1,
      candidatePreferenceScore: 0.5,
      qualityDelta: 0,
      passesAgreement: true,
      passesPreference: true,
      passesQualityNonInferiority: true,
    });
  });

  it('accepts an automated blind judgment only when swapped order agrees', async () => {
    let call = 0;
    const scores = {
      intentUnderstanding: 4,
      directness: 4,
      contextHandling: 4,
      clarificationEfficiency: 4,
      naturalness: 4,
      repetitionControl: 4,
    };
    const fetcher = vi.fn(async () => {
      const preference = call === 0 ? 'left' : 'right';
      call += 1;
      return new Response(JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify({
          preference,
          leftScores: scores,
          rightScores: scores,
          notes: 'consistent',
        }) }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const trace = passingResponse(coachMywayParityScenarios[0], 'candidate');
    const llm = passingResponse(coachMywayParityScenarios[0], 'llm');
    const item = {
      id: 'blind-test',
      scenarioId: trace.scenarioId,
      category: trace.category,
      transcript: trace.turns.map((turn) => turn.turn.query),
      left: trace.turns.map((turn) => turn.response),
      right: llm.turns.map((turn) => turn.response),
    };
    const rating = await createOpenAiBlindJudge({ apiKey: 'test-key', config, fetcher }).judge(item);
    expect(rating).toMatchObject({ completed: true, preference: 'left' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('detects corpus or knowledge drift in replay fixtures', async () => {
    const trace = passingResponse(coachMywayParityScenarios[0], 'candidate');
    const fixture = await createParityFixture(coachMywayParityScenarios, config, [trace]);
    expect(await validateParityFixture(fixture, coachMywayParityScenarios, config)).toEqual([]);
    const changed = { ...fixture, manifest: { ...fixture.manifest, corpusHash: 'changed' } };
    expect(await validateParityFixture(changed, coachMywayParityScenarios, config)).toContain('corpus hash mismatch');
  });
});
