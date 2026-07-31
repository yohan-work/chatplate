import { z } from 'zod';
import type { BotConfig } from '../types/chatbot';
import { validateSupportSchedule } from './supportOperations';

const nonEmpty = z.string().trim().min(1);
const answerButtonSchema = z.object({
  label: nonEmpty,
  type: z.enum(['url', 'action', 'tel', 'mailto']),
  value: nonEmpty,
});
const knowledgeSchema = z.object({
  id: nonEmpty,
  categoryId: nonEmpty,
  question: nonEmpty,
  keywords: z.array(z.string()),
  aliases: z.array(z.string()),
  intentId: z.string().optional(),
  answer: nonEmpty,
  buttons: z.array(answerButtonSchema),
  relatedIds: z.array(z.string()),
  priority: z.number().int(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
}).passthrough();

export const botConfigSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  bot: z.object({
    id: nonEmpty,
    name: nonEmpty,
    title: nonEmpty,
    description: z.string(),
    avatarUrl: z.string(),
    greeting: nonEmpty,
    fallbackMessage: nonEmpty,
    disclaimer: z.string(),
  }),
  theme: z.object({
    primaryColor: nonEmpty,
    position: z.enum(['bottom-right', 'bottom-left']),
    homeTitle: nonEmpty,
  }),
  operation: z.object({
    botHours: nonEmpty,
    csHours: nonEmpty,
    supportSchedule: z.object({
      timezone: nonEmpty,
      weekly: z.partialRecord(
        z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
        z.array(z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })),
      ),
      holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      firstResponseTargetMinutes: z.number().int().min(1).max(10080),
    }).optional(),
  }).passthrough(),
  notices: z.array(z.object({
    id: nonEmpty,
    title: nonEmpty,
    summary: z.string(),
    content: z.string(),
    createdAt: nonEmpty,
    unread: z.boolean(),
    imageUrl: z.string(),
    buttons: z.array(answerButtonSchema),
  })),
  contactChannels: z.array(z.object({
    id: nonEmpty,
    label: nonEmpty,
    type: z.enum(['url', 'action', 'tel', 'mailto']),
    value: nonEmpty,
    icon: z.enum(['kakao', 'naver', 'phone', 'email', 'map', 'more']),
  })),
  categories: z.array(z.object({ id: nonEmpty, name: nonEmpty })),
  quickReplies: z.array(z.object({ label: nonEmpty, knowledgeId: nonEmpty })),
  knowledge: z.array(knowledgeSchema),
}).passthrough().superRefine((config, context) => {
  if (config.operation.supportSchedule) {
    for (const message of validateSupportSchedule(config.operation.supportSchedule)) {
      context.addIssue({
        code: 'custom',
        path: ['operation', 'supportSchedule'],
        message,
      });
    }
  }
  const categoryIds = new Set(config.categories.map((category) => category.id));
  const knowledgeIds = new Set<string>();
  for (const item of config.knowledge) {
    if (knowledgeIds.has(item.id)) {
      context.addIssue({ code: 'custom', message: `중복 FAQ id: ${item.id}` });
    }
    knowledgeIds.add(item.id);
    if (!categoryIds.has(item.categoryId)) {
      context.addIssue({ code: 'custom', message: `존재하지 않는 categoryId: ${item.categoryId}` });
    }
  }
  for (const reply of config.quickReplies) {
    if (!knowledgeIds.has(reply.knowledgeId)) {
      context.addIssue({ code: 'custom', message: `빠른 질문의 FAQ가 없습니다: ${reply.knowledgeId}` });
    }
  }
});

export function parseBotConfig(value: unknown): BotConfig {
  return botConfigSchema.parse(value) as BotConfig;
}

export function botConfigValidationErrors(value: unknown): string[] {
  const result = botConfigSchema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.map((issue) =>
    `${issue.path.join('.') || 'config'}: ${issue.message}`,
  );
}
