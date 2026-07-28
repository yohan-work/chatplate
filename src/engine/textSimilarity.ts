import { normalizeText } from './normalizeText';

const STOPWORDS = new Set(['가능한가요', '궁금해요', '알려주세요', '어떻게', '있나요', '하나요', '싶어요', '되나요', '뭐예요', '어떤']);

export function tokenize(value: string): string[] {
  return normalizeText(value).split(' ').filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

export function ngrams(value: string): Map<string, number> {
  const compact = normalizeText(value).replace(/\s/g, '');
  const result = new Map<string, number>();
  const sizes = compact.length < 3 ? [2] : [2, 3];
  sizes.forEach((size) => {
    if (compact.length < size) {
      if (compact) result.set(`${size}:${compact}`, 1);
      return;
    }
    for (let index = 0; index <= compact.length - size; index += 1) {
      const gram = `${size}:${compact.slice(index, index + size)}`;
      result.set(gram, (result.get(gram) ?? 0) + 1);
    }
  });
  return result;
}

export function cosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
  if (!left.size || !right.size) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  left.forEach((value, key) => {
    dot += value * (right.get(key) ?? 0);
    leftMagnitude += value * value;
  });
  right.forEach((value) => {
    rightMagnitude += value * value;
  });
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function jaccardSimilarity(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) intersection += 1;
  });
  return intersection / new Set([...leftSet, ...rightSet]).size;
}

export function bm25Scores(queryTokens: string[], documents: string[][], k1 = 1.2, b = 0.75): number[] {
  if (!queryTokens.length || !documents.length) return documents.map(() => 0);
  const averageLength = documents.reduce((sum, document) => sum + document.length, 0) / documents.length || 1;
  const documentFrequency = new Map<string, number>();
  new Set(queryTokens).forEach((token) => {
    documentFrequency.set(token, documents.filter((document) => document.includes(token)).length);
  });

  const raw = documents.map((document) => {
    const frequencies = new Map<string, number>();
    document.forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1));
    return [...new Set(queryTokens)].reduce((score, token) => {
      const frequency = frequencies.get(token) ?? 0;
      if (!frequency) return score;
      const df = documentFrequency.get(token) ?? 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const denominator = frequency + k1 * (1 - b + b * (document.length / averageLength));
      return score + idf * ((frequency * (k1 + 1)) / denominator);
    }, 0);
  });
  const max = Math.max(...raw, 0);
  return raw.map((score) => (max ? score / max : 0));
}
