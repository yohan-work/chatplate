import alfDemo from './alf-demo.json';
import animalHospital from './animal-hospital.json';
import cafe from './cafe.json';
import coachMyway from './coach-myway.json';
import { coachMywayDraftKnowledge } from './coach-myway-drafts';
import { enrichCoachMywayDataset } from './coach-myway-utterances';
import { createDefaultSmallTalkConfig } from './smallTalkDefaults';
import lawOffice from './law-office.json';
import type { BotConfig } from '../types/chatbot';

function withSmallTalk(config: BotConfig): BotConfig {
  return {
    ...config,
    smallTalk: config.smallTalk ?? createDefaultSmallTalkConfig(config.bot),
  };
}

export const botConfigs: Record<string, BotConfig> = {
  'alf-demo': withSmallTalk(alfDemo as BotConfig),
  'animal-hospital': withSmallTalk(animalHospital as BotConfig),
  'law-office': withSmallTalk(lawOffice as BotConfig),
  cafe: withSmallTalk(cafe as BotConfig),
  'coach-myway': withSmallTalk({
    ...(coachMyway as BotConfig),
    knowledge: enrichCoachMywayDataset([...(coachMyway as BotConfig).knowledge, ...coachMywayDraftKnowledge]),
  }),
};

export const defaultBotId = 'coach-myway';
