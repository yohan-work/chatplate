import alfDemo from './alf-demo.json';
import animalHospital from './animal-hospital.json';
import cafe from './cafe.json';
import coachMyway from './coach-myway.json';
import { coachMywayAdviceKnowledge } from './coach-myway-advice';
import { coachMywayDraftKnowledge } from './coach-myway-drafts';
import { enrichCoachMywayDataset } from './coach-myway-utterances';
import { createDefaultSmallTalkConfig } from './smallTalkDefaults';
import lawOffice from './law-office.json';
import type { BotConfig } from '../types/chatbot';
import { SUPPORTED_SEEDS } from './coachMywayQualityCorpus';

function withSmallTalk(config: BotConfig): BotConfig {
  return {
    ...config,
    smallTalk: config.smallTalk ?? createDefaultSmallTalkConfig(config.bot),
  };
}

function withCoachQualitySeeds(config: BotConfig): BotConfig {
  const seedById = new Map(SUPPORTED_SEEDS.map(([id, query]) => [id, query]));
  return {
    ...config,
    categories: config.categories.some((category) => category.id === 'advice')
      ? config.categories
      : [...config.categories, { id: 'advice', name: '학습 조언' }],
    knowledge: config.knowledge.map((item) => {
      const text = seedById.get(item.id);
      if (!text) return item;
      const utterances = [...(item.utterances ?? [])];
      const replaceIndex = utterances.findIndex((utterance) => utterance.split === 'train' && !utterance.approved);
      const qualitySeed = {
        text,
        persona: 'neutral' as const,
        variation: 'synonym' as const,
        split: 'train' as const,
        source: 'representative' as const,
        approved: true,
      };
      if (replaceIndex >= 0) utterances[replaceIndex] = qualitySeed;
      else utterances.push(qualitySeed);
      return {
        ...item,
        utterances,
      };
    }),
  };
}

export const botConfigs: Record<string, BotConfig> = {
  'alf-demo': withSmallTalk(alfDemo as BotConfig),
  'animal-hospital': withSmallTalk(animalHospital as BotConfig),
  'law-office': withSmallTalk(lawOffice as BotConfig),
  cafe: withSmallTalk(cafe as BotConfig),
  'coach-myway': withCoachQualitySeeds(withSmallTalk({
    ...(coachMyway as BotConfig),
    knowledge: enrichCoachMywayDataset([
      ...(coachMyway as BotConfig).knowledge,
      ...coachMywayDraftKnowledge,
      ...coachMywayAdviceKnowledge,
    ]),
  })),
};

export const defaultBotId = 'coach-myway';
