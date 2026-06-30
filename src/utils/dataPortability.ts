import type { BotConfig, BotConfigMap, ConversationEvent } from '../types/chatbot';

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
  const headers = ['id', 'botId', 'query', 'status', 'confidence', 'matchedKnowledgeIds', 'feedback', 'createdAt'];
  const rows = events.map((event) => [
    event.id,
    event.botId,
    event.query,
    event.status,
    event.confidence,
    event.matchedKnowledgeIds.join('|'),
    event.feedback ?? '',
    event.createdAt,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
