import alfDemo from './alf-demo.json';
import animalHospital from './animal-hospital.json';
import cafe from './cafe.json';
import coachMyway from './coach-myway.json';
import lawOffice from './law-office.json';
import type { BotConfig } from '../types/chatbot';

export const botConfigs: Record<string, BotConfig> = {
  'alf-demo': alfDemo as BotConfig,
  'animal-hospital': animalHospital as BotConfig,
  'law-office': lawOffice as BotConfig,
  cafe: cafe as BotConfig,
  'coach-myway': coachMyway as BotConfig,
};

export const defaultBotId = 'coach-myway';
