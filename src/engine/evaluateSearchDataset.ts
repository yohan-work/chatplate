import type { BotConfig, SearchUtterance } from '../types/chatbot';
import { searchKnowledge } from './searchKnowledge';

export interface EvaluationMetrics {
  samples: number;
  top1Accuracy: number;
  top3Recall: number;
  fallbackRate: number;
  meanReciprocalRank: number;
  failures: Array<{ query: string; expectedId: string; rankedIds: string[] }>;
}

export function evaluateSearchDataset(
  config: BotConfig,
  split: NonNullable<SearchUtterance['split']> = 'test',
  limit = Number.POSITIVE_INFINITY,
): EvaluationMetrics {
  const samples = config.knowledge
    .flatMap((item) => (item.utterances ?? [])
      .filter((utterance) => utterance.split === split)
      .map((utterance) => ({ itemId: item.id, query: utterance.text })))
    .slice(0, limit);
  let top1 = 0;
  let top3 = 0;
  let fallback = 0;
  let reciprocalRank = 0;
  const failures: EvaluationMetrics['failures'] = [];

  samples.forEach((sample) => {
    const result = searchKnowledge(sample.query, config);
    const rankedIds = [
      ...(result.items ?? (result.item ? [result.item] : [])),
      ...result.suggestions,
      ...result.alternatives,
    ].map((item) => item.id).filter((id, index, values) => values.indexOf(id) === index);
    const rank = rankedIds.indexOf(sample.itemId);
    if (rank === 0) top1 += 1;
    if (rank >= 0 && rank < 3) top3 += 1;
    if (rank >= 0) reciprocalRank += 1 / (rank + 1);
    if (rank < 0 || rank >= 3) failures.push({ query: sample.query, expectedId: sample.itemId, rankedIds: rankedIds.slice(0, 3) });
    if (result.status === 'fallback') fallback += 1;
  });

  const count = samples.length || 1;
  return {
    samples: samples.length,
    top1Accuracy: top1 / count,
    top3Recall: top3 / count,
    fallbackRate: fallback / count,
    meanReciprocalRank: reciprocalRank / count,
    failures,
  };
}
