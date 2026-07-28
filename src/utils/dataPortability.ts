import { validateSmallTalkConfig } from '../engine/resolveConversation';
import type { BotConfig, BotConfigMap, ConversationEvent, SmallTalkConfig, SmallTalkIntentId } from '../types/chatbot';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasArray(value: Record<string, unknown>, key: string): boolean {
  return Array.isArray(value[key]);
}

function hasObject(value: Record<string, unknown>, key: string): boolean {
  return isRecord(value[key]);
}

export function validateBotConfig(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['Bot config must be an object.'] };
  }

  ['bot', 'theme', 'operation'].forEach((key) => {
    if (!hasObject(value, key)) errors.push(`Missing object field: ${key}`);
  });

  ['notices', 'contactChannels', 'categories', 'quickReplies', 'knowledge'].forEach((key) => {
    if (!hasArray(value, key)) errors.push(`Missing array field: ${key}`);
  });

  const bot = isRecord(value.bot) ? value.bot : {};
  ['id', 'name', 'title', 'description', 'greeting', 'fallbackMessage', 'disclaimer'].forEach((key) => {
    if (typeof bot[key] !== 'string') errors.push(`Missing bot.${key}`);
  });

  const theme = isRecord(value.theme) ? value.theme : {};
  if (typeof theme.primaryColor !== 'string') errors.push('Missing theme.primaryColor');
  if (typeof theme.homeTitle !== 'string') errors.push('Missing theme.homeTitle');

  if (value.customerJourneys !== undefined && !Array.isArray(value.customerJourneys)) errors.push('customerJourneys must be an array when provided');
  if (value.search !== undefined && !isRecord(value.search)) errors.push('search must be an object when provided');
  if (value.smallTalk !== undefined) {
    if (!isRecord(value.smallTalk)) {
      errors.push('smallTalk must be an object when provided');
    } else {
      const smallTalk = value.smallTalk;
      const allowedIntents = new Set<SmallTalkIntentId>(['greeting', 'thanks', 'goodbye', 'help', 'identity', 'human', 'abuse', 'noise']);
      if (typeof smallTalk.enabled !== 'boolean') errors.push('smallTalk.enabled must be a boolean');
      if (!Array.isArray(smallTalk.rules)) {
        errors.push('smallTalk.rules must be an array');
      } else {
        let shapeIsValid = true;
        smallTalk.rules.forEach((rule, index) => {
          if (!isRecord(rule)) {
            errors.push(`smallTalk.rules[${index}] must be an object`);
            shapeIsValid = false;
            return;
          }
          ['id', 'label', 'response'].forEach((key) => {
            if (typeof rule[key] !== 'string') {
              errors.push(`smallTalk.rules[${index}].${key} must be a string`);
              shapeIsValid = false;
            }
          });
          if (typeof rule.intentId !== 'string' || !allowedIntents.has(rule.intentId as SmallTalkIntentId)) {
            errors.push(`smallTalk.rules[${index}].intentId is invalid`);
            shapeIsValid = false;
          }
          ['enabled', 'handoffCta', 'showSuggestions'].forEach((key) => {
            if (typeof rule[key] !== 'boolean') {
              errors.push(`smallTalk.rules[${index}].${key} must be a boolean`);
              shapeIsValid = false;
            }
          });
          if (!Array.isArray(rule.utterances) || !rule.utterances.every((utterance) => typeof utterance === 'string')) {
            errors.push(`smallTalk.rules[${index}].utterances must be a string array`);
            shapeIsValid = false;
          }
        });
        if (shapeIsValid) errors.push(...validateSmallTalkConfig(smallTalk as unknown as SmallTalkConfig));
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateBotConfigMap(value: unknown): ValidationResult {
  if (!isRecord(value)) return { ok: false, errors: ['Bot config map must be an object.'] };

  const errors = Object.entries(value).flatMap(([botId, config]) =>
    validateBotConfig(config).errors.map((error) => `${botId}: ${error}`),
  );

  return { ok: errors.length === 0, errors };
}

export function parseBotConfigJson(rawValue: string): { configs?: BotConfigMap; errors: string[] } {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const singleValidation = validateBotConfig(parsed);
    if (singleValidation.ok) {
      const config = parsed as BotConfig;
      return { configs: { [config.bot.id]: config }, errors: [] };
    }

    const mapValidation = validateBotConfigMap(parsed);
    if (mapValidation.ok) return { configs: parsed as BotConfigMap, errors: [] };

    return { errors: [...singleValidation.errors, ...mapValidation.errors] };
  } catch {
    return { errors: ['JSON parsing failed.'] };
  }
}

export function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function escapeCsvCell(value: unknown): string {
  const rawValue = String(value ?? '');
  if (/[",\n]/.test(rawValue)) return `"${rawValue.replace(/"/g, '""')}"`;
  return rawValue;
}

export function conversationEventsToCsv(events: ConversationEvent[]): string {
  const headers = [
    'id',
    'botId',
    'query',
    'status',
    'confidence',
    'interactionType',
    'effectiveQuery',
    'smallTalkIntent',
    'matchedKnowledgeIds',
    'candidateKnowledgeIds',
    'topScore',
    'scoreMargin',
    'matchedUtterance',
    'decisionReason',
    'feedback',
    'createdAt',
  ];
  const rows = events.map((event) => [
    event.id,
    event.botId,
    event.query,
    event.status,
    event.confidence,
    event.interactionType ?? '',
    event.effectiveQuery ?? '',
    event.smallTalkIntent ?? '',
    event.matchedKnowledgeIds.join('|'),
    event.candidateKnowledgeIds?.join('|') ?? '',
    event.topScore ?? '',
    event.scoreMargin ?? '',
    event.matchedUtterance ?? '',
    event.decisionReason ?? '',
    event.feedback ?? '',
    event.createdAt,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
