import { z } from 'zod';
import type { AnswerTrust, BotConfig } from '../types/chatbot';
import type {
  ConversationParityScenario,
  EvaluationResponder,
  ParityPolicy,
  ParityResponse,
} from './conversationParityTypes';

const responseSchema = z.object({
  policy: z.enum(['answer', 'clarify', 'fallback', 'smalltalk']),
  knowledgeIds: z.array(z.string()),
  answerTrust: z.enum(['verified', 'bounded', 'unverified']),
  replyText: z.string().min(1),
  handoff: z.boolean(),
});

interface OpenAiResponsesPayload {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
}

export interface OpenAiEvaluationResponderOptions {
  apiKey: string;
  config: BotConfig;
  model?: string;
  endpoint?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
}

export const PARITY_PROMPT_VERSION = 'coach-myway-parity-v1';
export const DEFAULT_PARITY_MODEL = 'gpt-5.6-sol';

function knowledgePacket(config: BotConfig): string {
  return JSON.stringify(config.knowledge.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    approvalStatus: item.approvalStatus ?? 'unknown',
    answerMode: item.answerMode,
    riskLevel: item.riskLevel,
    handoffRecommended: Boolean(item.handoffRecommended),
  })));
}

function instructions(config: BotConfig): string {
  return [
    'Role: 코치 마이:웨이의 평가 전용 상담 답변기.',
    'Goal: 주어진 등록 지식만 사용해 사용자의 현재 질문에 답한다.',
    'Success: 충분한 근거가 있으면 직접 답하고, 대상이 모호하면 가장 작은 한 가지를 되묻고, 범위 밖·안전 요청은 제한 이유와 안전한 다음 행동을 안내한다.',
    'Constraints: 외부 지식과 추측을 사용하지 않는다. pending 또는 unknown 항목은 구체적 운영 사실을 확정하지 말고 answerTrust=bounded로 제한한다. 다른 사람 정보, 진단, 보장, 법률 판단, 과제 대행은 거절하고 handoff=true로 둔다.',
    'Style: 한국어로 직접적이고 자연스럽게 답한다. 사용자가 걱정·불만·정정을 표현하면 그 구체적 내용을 짧게 인정한다. 같은 서두를 반복하지 않는다.',
    'Output: JSON schema를 정확히 따른다. knowledgeIds에는 실제로 사용한 등록 지식 ID만 넣는다.',
    `Bot fallback: ${config.bot.fallbackMessage}`,
    `Knowledge packet: ${knowledgePacket(config)}`,
  ].join('\n\n');
}

function extractOutputText(payload: OpenAiResponsesPayload): string {
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  throw new Error(payload.error?.message ?? 'OpenAI response did not contain output_text');
}

function asParityResponse(value: z.infer<typeof responseSchema>): ParityResponse {
  return {
    policy: value.policy as ParityPolicy,
    knowledgeIds: value.knowledgeIds,
    answerTrust: value.answerTrust as AnswerTrust,
    replyText: value.replyText,
    handoff: value.handoff,
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export function createOpenAiEvaluationResponder(options: OpenAiEvaluationResponderOptions): EvaluationResponder {
  const fetcher = options.fetcher ?? fetch;
  const endpoint = options.endpoint ?? 'https://api.openai.com/v1/responses';
  const model = options.model ?? DEFAULT_PARITY_MODEL;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxRetries = options.maxRetries ?? 2;
  const baseInstructions = instructions(options.config);

  async function request(history: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<ParityResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetcher(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            instructions: baseInstructions,
            input: history.map((entry) => ({ role: entry.role, content: entry.content })),
            reasoning: { effort: 'medium' },
            text: {
              verbosity: 'low',
              format: {
                type: 'json_schema',
                name: 'coach_myway_parity_response',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    policy: { type: 'string', enum: ['answer', 'clarify', 'fallback', 'smalltalk'] },
                    knowledgeIds: { type: 'array', items: { type: 'string' } },
                    answerTrust: { type: 'string', enum: ['verified', 'bounded', 'unverified'] },
                    replyText: { type: 'string' },
                    handoff: { type: 'boolean' },
                  },
                  required: ['policy', 'knowledgeIds', 'answerTrust', 'replyText', 'handoff'],
                },
              },
            },
            store: false,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const payload = await response.json() as OpenAiResponsesPayload;
        if (!response.ok) throw new Error(payload.error?.message ?? `OpenAI Responses API failed with ${response.status}`);
        return asParityResponse(responseSchema.parse(JSON.parse(extractOutputText(payload))));
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) await wait(250 * (2 ** attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('OpenAI evaluation request failed');
  }

  return {
    engine: 'llm',
    async respond(scenario: ConversationParityScenario) {
      const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      const responses: ParityResponse[] = [];
      for (const turn of scenario.turns) {
        history.push({ role: 'user', content: turn.query });
        const response = await request(history);
        responses.push(response);
        history.push({ role: 'assistant', content: response.replyText });
      }
      return responses;
    },
  };
}
