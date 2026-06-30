import { useEffect, useState } from 'react';
import { AdminWorkspace } from '../components/admin/AdminWorkspace';
import { botConfigs, defaultBotId } from '../data/bots';
import type { BotConfig, BotConfigMap } from '../types/chatbot';
import { cloneBotConfigs, loadStoredBotConfigs, saveStoredBotConfigs } from '../utils/botConfigStorage';

export function App() {
  const [selectedBotId, setSelectedBotId] = useState(defaultBotId);
  const [editableBotConfigs, setEditableBotConfigs] = useState<BotConfigMap>(() => loadStoredBotConfigs() ?? cloneBotConfigs(botConfigs));
  const [unknownQuestionsByBotId, setUnknownQuestionsByBotId] = useState<Record<string, string[]>>({});

  useEffect(() => {
    saveStoredBotConfigs(editableBotConfigs);
  }, [editableBotConfigs]);

  const updateSelectedBotConfig = (updater: (config: BotConfig) => BotConfig) => {
    setEditableBotConfigs((current) => ({
      ...current,
      [selectedBotId]: updater(current[selectedBotId]),
    }));
  };

  const resetSelectedBot = () => {
    setEditableBotConfigs((current) => ({
      ...current,
      [selectedBotId]: cloneBotConfigs({ [selectedBotId]: botConfigs[selectedBotId] })[selectedBotId],
    }));
    setUnknownQuestionsByBotId((current) => ({ ...current, [selectedBotId]: [] }));
  };

  const handleUnknownQuestion = (question: string) => {
    setUnknownQuestionsByBotId((current) => ({
      ...current,
      [selectedBotId]: [...(current[selectedBotId] ?? []), question],
    }));
  };

  return (
    <AdminWorkspace
      botConfigs={editableBotConfigs}
      selectedBotId={selectedBotId}
      unknownQuestions={unknownQuestionsByBotId[selectedBotId] ?? []}
      onSelectBot={setSelectedBotId}
      onUpdateBotConfig={updateSelectedBotConfig}
      onReplaceBotConfigs={setEditableBotConfigs}
      onResetBot={resetSelectedBot}
      onUnknownQuestion={handleUnknownQuestion}
    />
  );
}
