import type { BotConfig } from '../types/chatbot';
import type {
  ConversationParityScenario,
  EvalRunManifest,
  ParityEngine,
  ParityFixture,
  ParityTrace,
} from './conversationParityTypes';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createParityFixture(
  scenarios: ConversationParityScenario[],
  config: BotConfig,
  traces: ParityTrace[],
  options?: { model?: string; promptVersion?: string },
): Promise<ParityFixture> {
  const engines = [...new Set(traces.map((trace) => trace.engine))] as ParityEngine[];
  const knowledge = config.knowledge.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    approvalStatus: item.approvalStatus,
    answerMode: item.answerMode,
    riskLevel: item.riskLevel,
  }));
  const manifest: EvalRunManifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    corpusHash: await sha256(scenarios),
    knowledgeHash: await sha256(knowledge),
    engines,
    model: options?.model,
    promptVersion: options?.promptVersion,
  };
  return { manifest, traces };
}

export async function validateParityFixture(
  fixture: ParityFixture,
  scenarios: ConversationParityScenario[],
  config: BotConfig,
): Promise<string[]> {
  const expected = await createParityFixture(scenarios, config, fixture.traces, {
    model: fixture.manifest.model,
    promptVersion: fixture.manifest.promptVersion,
  });
  const errors: string[] = [];
  if (fixture.manifest.schemaVersion !== 1) errors.push(`unsupported schema version: ${fixture.manifest.schemaVersion}`);
  if (fixture.manifest.corpusHash !== expected.manifest.corpusHash) errors.push('corpus hash mismatch');
  if (fixture.manifest.knowledgeHash !== expected.manifest.knowledgeHash) errors.push('knowledge hash mismatch');
  return errors;
}
