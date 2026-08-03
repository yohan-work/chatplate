import type {
  ConversationAudience,
  DialogueAct,
  GuardCategory,
} from '../types/chatbot';
import type { ParityCategory, ParityPolicy } from './conversationParityTypes';

export type ConversationDatasetSource = 'hypothesis' | 'authored' | 'mutation' | 'production';
export type ConversationDatasetStatus = 'draft' | 'reviewed' | 'frozen' | 'promoted' | 'retired' | 'rejected-sensitive';
export type ConversationDatasetSplit = 'development' | 'challenge' | 'sealed' | 'production-inbox';
export type ConversationJourneyStage =
  | 'discovery'
  | 'fit'
  | 'consultation'
  | 'registration'
  | 'coaching'
  | 'policy'
  | 'support'
  | 'relationship'
  | 'safety';
export type ConversationDifficultyTag =
  | 'paraphrase'
  | 'colloquial'
  | 'spacing'
  | 'typo'
  | 'ellipsis'
  | 'ambiguity'
  | 'context'
  | 'correction'
  | 'reference'
  | 'compound'
  | 'emotion'
  | 'safety'
  | 'boundary';

export interface ConversationDatasetTurnExpectation {
  acceptedPolicies: ParityPolicy[];
  acceptedKnowledgeIds?: string[];
  requiredKnowledgeIds?: string[];
  forbiddenKnowledgeIds?: string[];
  expectedGuardCategory?: GuardCategory;
  requiresHandoff?: boolean;
  requiresCorrectionAcknowledgement?: boolean;
  requiredConcepts?: string[];
  forbiddenPhrases?: string[];
  maxReplyChars?: number;
  allowedTones?: Array<'neutral' | 'parent' | 'student' | 'empathetic' | 'safety'>;
}

export interface ConversationDatasetTurn {
  id: string;
  query: string;
  expectedDialogueActs?: DialogueAct[];
  expectation: ConversationDatasetTurnExpectation;
}

export interface ConversationDatasetReview {
  reviewerId: string;
  reviewedAt: string;
  verdict: 'approved' | 'rejected' | 'needs-change';
  note?: string;
}

export interface ConversationDatasetScenario {
  id: string;
  schemaVersion: 1;
  semanticGroupId: string;
  parentScenarioId?: string;
  source: ConversationDatasetSource;
  authorRole: 'domain-author' | 'qa-author' | 'production-import';
  createdAt: string;
  audience: ConversationAudience;
  journeyStage: ConversationJourneyStage;
  category: ParityCategory;
  difficultyTags: ConversationDifficultyTag[];
  intentIds: string[];
  split: ConversationDatasetSplit;
  status: ConversationDatasetStatus;
  reviews: ConversationDatasetReview[];
  turns: ConversationDatasetTurn[];
}

export interface ConversationDatasetManifest {
  schemaVersion: 1;
  datasetVersion: string;
  createdAt: string;
  corpusHash: string;
  knowledgeHash: string;
  scenarioCount: number;
  turnCount: number;
  splitCounts: Record<ConversationDatasetSplit, number>;
}
