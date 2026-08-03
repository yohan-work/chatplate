import { z } from 'zod';
import type { BotConfig } from '../types/chatbot';
import type { BlindPreference, BlindQualityScores, BlindRating, BlindReviewItem } from './conversationParityTypes';
import { DEFAULT_PARITY_MODEL } from './openAiEvaluationResponder';

const scoreSchema = z.object({
  intentUnderstanding: z.number().int().min(1).max(5),
  directness: z.number().int().min(1).max(5),
  contextHandling: z.number().int().min(1).max(5),
  clarificationEfficiency: z.number().int().min(1).max(5),
  naturalness: z.number().int().min(1).max(5),
  repetitionControl: z.number().int().min(1).max(5),
});
const judgeSchema = z.object({
  preference: z.enum(['left', 'tie', 'right']),
  leftScores: scoreSchema,
  rightScores: scoreSchema,
  notes: z.string(),
});

interface JudgeOptions {
  apiKey: string;
  config: BotConfig;
  model?: string;
  endpoint?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

function extractOutputText(payload: unknown): string {
  const response = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  throw new Error(response.error?.message ?? 'Judge response did not contain output_text');
}

function asScores(scores: z.infer<typeof scoreSchema>): BlindQualityScores {
  return scores as BlindQualityScores;
}

function inverse(preference: BlindPreference): BlindPreference {
  return preference === 'left' ? 'right' : preference === 'right' ? 'left' : 'tie';
}

function stringifyResponses(item: BlindReviewItem, swapped: boolean): string {
  const left = swapped ? item.right : item.left;
  const right = swapped ? item.left : item.right;
  return JSON.stringify({ transcript: item.transcript, left, right });
}

export function createOpenAiBlindJudge(options: JudgeOptions): {
  judge(item: BlindReviewItem): Promise<BlindRating>;
} {
  const fetcher = options.fetcher ?? fetch;
  const endpoint = options.endpoint ?? 'https://api.openai.com/v1/responses';
  const model = options.model ?? DEFAULT_PARITY_MODEL;
  const knowledge = JSON.stringify(options.config.knowledge.map((item) => ({
    id: item.id,
    answer: item.answer,
    approvalStatus: item.approvalStatus,
    handoffRecommended: item.handoffRecommended,
  })));

  async function onePass(item: BlindReviewItem, swapped: boolean): Promise<z.infer<typeof judgeSchema>> {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'medium' },
        store: false,
        instructions: [
          '두 익명 상담 답변을 동일한 기준으로 평가한다. 엔진을 추측하거나 문체 취향만으로 고르지 않는다.',
          '사실성·안전성·질문 해결을 우선하고, intent 이해·직접성·문맥·되묻기 효율·자연스러움·반복 억제를 각각 1~5점으로 평가한다.',
          '등록 지식 밖의 사실을 추가한 답변은 낮게 평가한다. pending 지식은 한계를 밝히는 것이 맞다.',
          `등록 지식: ${knowledge}`,
        ].join('\n\n'),
        input: stringifyResponses(item, swapped),
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'blind_conversation_judgment',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                preference: { type: 'string', enum: ['left', 'tie', 'right'] },
                leftScores: { $ref: '#/$defs/scores' },
                rightScores: { $ref: '#/$defs/scores' },
                notes: { type: 'string' },
              },
              required: ['preference', 'leftScores', 'rightScores', 'notes'],
              $defs: {
                scores: {
                  type: 'object',
                  additionalProperties: false,
                  properties: Object.fromEntries([
                    'intentUnderstanding', 'directness', 'contextHandling',
                    'clarificationEfficiency', 'naturalness', 'repetitionControl',
                  ].map((name) => [name, { type: 'integer', minimum: 1, maximum: 5 }])),
                  required: [
                    'intentUnderstanding', 'directness', 'contextHandling',
                    'clarificationEfficiency', 'naturalness', 'repetitionControl',
                  ],
                },
              },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
    const payload = await response.json() as unknown;
    if (!response.ok) throw new Error((payload as { error?: { message?: string } }).error?.message ?? `Judge API failed with ${response.status}`);
    return judgeSchema.parse(JSON.parse(extractOutputText(payload)));
  }

  return {
    async judge(item) {
      const [normal, swapped] = await Promise.all([onePass(item, false), onePass(item, true)]);
      const consistent = normal.preference === inverse(swapped.preference);
      return {
        itemId: item.id,
        reviewerId: 'llm-judge-order-check',
        completed: consistent,
        preference: normal.preference,
        leftScores: asScores(normal.leftScores),
        rightScores: asScores(normal.rightScores),
        notes: consistent
          ? normal.notes
          : `order-inconsistent: normal=${normal.preference}, swapped=${swapped.preference}`,
      };
    },
  };
}

export async function judgeBlindReviewConcurrently(
  items: BlindReviewItem[],
  judge: ReturnType<typeof createOpenAiBlindJudge>,
  concurrency = 3,
): Promise<BlindRating[]> {
  const results = new Array<BlindRating>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await judge.judge(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker()));
  return results;
}
