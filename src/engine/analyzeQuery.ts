import { normalizeText } from './normalizeText';

const CONNECTOR_PATTERN = /\s*(?:랑|하고|와|과|및|그리고|또|또한)\s+/g;
const PARTICLES = /(?:은|는|이|가|을|를|에|에서|으로|로|도|만|요|나요|인가요|해요|까요)$/;

export interface QueryAnalysis {
  original: string;
  normalized: string;
  compact: string;
  tokens: string[];
  intents: string[];
}

function stemToken(token: string): string {
  return token.replace(PARTICLES, '');
}

export function analyzeQuery(query: string): QueryAnalysis {
  const normalized = normalizeText(query);
  const tokens = normalized
    .split(' ')
    .map(stemToken)
    .filter((token) => token.length >= 2);
  const intents = normalized
    .split(CONNECTOR_PATTERN)
    .map((intent) => intent.trim())
    .filter((intent) => intent.length >= 2);

  return {
    original: query,
    normalized,
    compact: normalized.replace(/\s/g, ''),
    tokens,
    intents: intents.length > 1 ? intents : [normalized],
  };
}
