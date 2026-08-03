import type {
  AnswerMode,
  ConversationEngineVariant,
  ConversationRouteDecision,
  KnowledgeRisk,
  MatchedField,
  SearchConfidence,
  SearchScoreBreakdown,
  SmallTalkIntentId,
} from '../types/chatbot';

export type AuditCategory =
  | 'faq-coverage'
  | 'robustness'
  | 'contrast'
  | 'ambiguous'
  | 'context'
  | 'unsupported'
  | 'safety';

export type AuditProcessingPolicy = 'answer' | 'clarify' | 'fallback' | 'smalltalk';
export type AuditSourceStatus = 'known' | 'draft-safe' | 'unverifiable';
export type AuditOverallVerdict = 'acceptable' | 'needs-improvement' | 'unsafe';

export interface ConversationAuditExpectation {
  acceptedKnowledgeIds?: string[];
  forbiddenKnowledgeIds?: string[];
  acceptedPolicies: AuditProcessingPolicy[];
  requiresHandoff?: boolean;
  safeKnowledgeIds?: string[];
}

export interface ConversationAuditCase {
  id: string;
  category: AuditCategory;
  query: string;
  previousTurns?: string[];
  expectation: ConversationAuditExpectation;
  rationale: string;
}

export interface AuditedCandidate {
  id: string;
  question: string;
  score?: number;
  confidence?: SearchConfidence;
  matchedFields?: MatchedField[];
  debugScore?: SearchScoreBreakdown;
  sourceStatus: AuditSourceStatus;
  source?: string;
  answerMode?: AnswerMode;
  riskLevel?: KnowledgeRisk;
  handoffRecommended: boolean;
}

export interface ConversationAuditVerdict {
  retrievalPass: boolean;
  routingPass: boolean;
  groundednessPass: boolean;
  calibrationPass: boolean;
  safetyPass: boolean;
  handoffPass: boolean;
  overall: AuditOverallVerdict;
  reasons: string[];
}

export interface ConversationAuditRecord {
  caseId: string;
  category: AuditCategory;
  variant: ConversationEngineVariant;
  query: string;
  previousTurns: string[];
  normalizedQuery: string;
  effectiveQuery: string;
  unsupportedGuardMatched: boolean;
  curatedKnowledgeId?: string;
  smallTalkIntent?: SmallTalkIntentId;
  actualPolicy: AuditProcessingPolicy;
  routeDecision?: ConversationRouteDecision;
  status?: 'answer' | 'suggestions' | 'fallback';
  confidence?: SearchConfidence;
  score?: number;
  scoreMargin?: number;
  matchedFields: MatchedField[];
  matchedUtterance?: string;
  primaryKnowledgeIds: string[];
  candidateKnowledgeIds: string[];
  candidates: AuditedCandidate[];
  renderedAnswer: string;
  handoffOffered: boolean;
  verdict: ConversationAuditVerdict;
}

export interface KnowledgeAnswerAudit {
  knowledgeId: string;
  question: string;
  sourceStatus: AuditSourceStatus;
  factualStatus: 'known' | 'unverifiable';
  answerMode?: AnswerMode;
  riskLevel?: KnowledgeRisk;
  directness: 0 | 1 | 2;
  completeness: 0 | 1 | 2;
  safetyPass: boolean;
  overall: AuditOverallVerdict;
  reasons: string[];
}

export interface ConversationAuditSummary {
  caseCount: number;
  recordCount: number;
  knowledgeCount: number;
  byCategory: Record<AuditCategory, number>;
  candidate: {
    acceptable: number;
    needsImprovement: number;
    unsafe: number;
    retrievalFailures: number;
    routingFailures: number;
    groundingFailures: number;
    calibrationFailures: number;
    safetyFailures: number;
    handoffFailures: number;
  };
  baseline: ConversationAuditSummary['candidate'];
  knowledge: {
    known: number;
    draftSafe: number;
    unverifiable: number;
    direct: number;
    genericOrDeflective: number;
  };
  priorityFindings: Array<{
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    code: string;
    count: number;
    description: string;
    caseIds: string[];
  }>;
}
