import type { AnswerTrust, ConversationRouteMode, GuardCategory } from '../types/chatbot';

export type ParityEngine = 'baseline' | 'candidate' | 'llm';
export type ParitySplit = 'diagnostic' | 'holdout';
export type ParityCategory =
  | 'paraphrase'
  | 'ambiguity'
  | 'context-correction'
  | 'compound'
  | 'emotion'
  | 'safety'
  | 'boundary';
export type ParityPolicy = 'answer' | 'clarify' | 'fallback' | 'smalltalk';

export interface ParityTurnExpectation {
  acceptedPolicies: ParityPolicy[];
  acceptedKnowledgeIds?: string[];
  requiredKnowledgeIds?: string[];
  forbiddenKnowledgeIds?: string[];
  requiresHandoff?: boolean;
  requiresCorrectionAcknowledgement?: boolean;
}

export interface ConversationParityTurn {
  id: string;
  query: string;
  expectation: ParityTurnExpectation;
}

export interface ConversationParityScenario {
  id: string;
  category: ParityCategory;
  split: ParitySplit;
  turns: ConversationParityTurn[];
}

export interface ParityResponse {
  policy: ParityPolicy;
  knowledgeIds: string[];
  answerTrust?: AnswerTrust;
  replyText: string;
  /** Legacy fixture field. Prefer explicitHandoff for deterministic traces. */
  handoff: boolean;
  explicitHandoff?: boolean;
  guardCategory?: GuardCategory;
  routeMode?: ConversationRouteMode;
  pendingCandidateIds?: string[];
  excludedKnowledgeIds?: string[];
  matchedFields?: string[];
  score?: number;
  scoreMargin?: number;
}

export interface EvaluationResponder {
  readonly engine: ParityEngine;
  respond(scenario: ConversationParityScenario): Promise<ParityResponse[]>;
}

export interface ParityTurnVerdict {
  policyPass: boolean;
  retrievalPass: boolean;
  forbiddenPass: boolean;
  handoffPass: boolean;
  trustPass: boolean;
  resolved: boolean;
  hardGatePass: boolean;
  reasons: string[];
}

export type ParityFailureReason =
  | 'wrong-policy'
  | 'wrong-retrieval'
  | 'missing-clarification-candidate'
  | 'incomplete-compound-answer'
  | 'stale-or-forbidden-knowledge'
  | 'correction-state-not-replaced'
  | 'missing-explicit-handoff'
  | 'unverified-answer'
  | 'correction-not-acknowledged';

export interface ParityTrace {
  scenarioId: string;
  category: ParityCategory;
  split: ParitySplit;
  engine: ParityEngine;
  turns: Array<{
    turn: ConversationParityTurn;
    response: ParityResponse;
    verdict: ParityTurnVerdict;
  }>;
}

export interface EvalRunManifest {
  schemaVersion: 1;
  createdAt: string;
  corpusHash: string;
  knowledgeHash: string;
  engines: ParityEngine[];
  model?: string;
  promptVersion?: string;
}

export type BlindPreference = 'left' | 'tie' | 'right';

export interface BlindReviewItem {
  id: string;
  scenarioId: string;
  category: ParityCategory;
  transcript: string[];
  left: ParityResponse[];
  right: ParityResponse[];
}

export interface BlindRating {
  itemId: string;
  reviewerId: string;
  completed: boolean;
  preference: BlindPreference;
  leftScores: BlindQualityScores;
  rightScores: BlindQualityScores;
  notes?: string;
}

export interface BlindQualityScores {
  intentUnderstanding: 1 | 2 | 3 | 4 | 5;
  directness: 1 | 2 | 3 | 4 | 5;
  contextHandling: 1 | 2 | 3 | 4 | 5;
  clarificationEfficiency: 1 | 2 | 3 | 4 | 5;
  naturalness: 1 | 2 | 3 | 4 | 5;
  repetitionControl: 1 | 2 | 3 | 4 | 5;
}

export interface ParityFixture {
  manifest: EvalRunManifest;
  traces: ParityTrace[];
  blindKey?: Record<string, { left: ParityEngine; right: ParityEngine }>;
  ratings?: BlindRating[];
}
