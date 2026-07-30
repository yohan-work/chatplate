import { useEffect, useMemo, useState } from 'react';
import { AdminWorkspace } from '../components/admin/AdminWorkspace';
import { botConfigs, defaultBotId } from '../data/bots';
import type { BotConfig, BotConfigMap } from '../types/chatbot';
import { cloneBotConfigs, loadStoredBotConfigs, saveStoredBotConfigs } from '../utils/botConfigStorage';
import { getBotConfigRepository } from '../services/getBotConfigRepository';

export function App() {
  const [selectedBotId, setSelectedBotId] = useState(defaultBotId);
  const [editableBotConfigs, setEditableBotConfigs] = useState<BotConfigMap>(() => ({
    ...cloneBotConfigs(botConfigs),
    ...(loadStoredBotConfigs() ?? {}),
  }));
  const [unknownQuestionsByBotId, setUnknownQuestionsByBotId] = useState<Record<string, string[]>>({});
  const configRepository = useMemo(() => getBotConfigRepository('admin'), []);
  const [releaseState, setReleaseState] = useState<{
    draftVersion?: number;
    publishedVersion?: number;
    isWorking: boolean;
    message?: string;
    archivedVersions?: number[];
  }>({ isWorking: false, archivedVersions: [] });

  useEffect(() => {
    let active = true;
    void Promise.all([
      configRepository.getDraft(selectedBotId),
      configRepository.getPublished(selectedBotId),
      configRepository.listVersions(selectedBotId),
    ]).then(([draft, published, versions]) => {
      if (active) {
        setReleaseState({
          draftVersion: draft?.version,
          publishedVersion: published?.version,
          isWorking: false,
          archivedVersions: versions.filter((entry) => entry.state === 'archived').map((entry) => entry.version),
        });
      }
    }).catch((error: unknown) => {
      if (active) {
        setReleaseState({
          isWorking: false,
          message: error instanceof Error ? error.message : '배포 상태를 불러오지 못했습니다.',
        });
      }
    });
    return () => {
      active = false;
    };
  }, [configRepository, selectedBotId]);

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

  const saveDraft = async () => {
    setReleaseState((current) => ({ ...current, isWorking: true, message: undefined }));
    try {
      const currentDraft = await configRepository.getDraft(selectedBotId);
      const draft = await configRepository.saveDraft(
        selectedBotId,
        currentDraft?.version ?? null,
        editableBotConfigs[selectedBotId],
        'current-admin',
      );
      setReleaseState((current) => ({
        ...current,
        draftVersion: draft.version,
        isWorking: false,
        message: `초안 v${draft.version} 저장 완료`,
      }));
    } catch (error) {
      setReleaseState((current) => ({
        ...current,
        isWorking: false,
        message: error instanceof Error ? error.message : '초안을 저장하지 못했습니다.',
      }));
    }
  };

  const publishDraft = async () => {
    setReleaseState((current) => ({ ...current, isWorking: true, message: undefined }));
    try {
      let draft = await configRepository.getDraft(selectedBotId);
      if (!draft) {
        draft = await configRepository.saveDraft(
          selectedBotId,
          null,
          editableBotConfigs[selectedBotId],
          'current-admin',
        );
      }
      const published = await configRepository.publish(selectedBotId, draft.version, 'current-admin');
      setReleaseState({
        publishedVersion: published.version,
        isWorking: false,
        archivedVersions: [
          ...(releaseState.publishedVersion ? [releaseState.publishedVersion] : []),
          ...(releaseState.archivedVersions ?? []),
        ],
        message: `v${published.version} 고객 배포 완료`,
      });
    } catch (error) {
      setReleaseState((current) => ({
        ...current,
        isWorking: false,
        message: error instanceof Error ? error.message : '배포하지 못했습니다.',
      }));
    }
  };

  const rollbackConfig = async (version: number) => {
    setReleaseState((current) => ({ ...current, isWorking: true, message: undefined }));
    try {
      const restored = await configRepository.rollback(selectedBotId, version, 'current-admin');
      setEditableBotConfigs((current) => ({ ...current, [selectedBotId]: restored.config }));
      const versions = await configRepository.listVersions(selectedBotId);
      setReleaseState({
        publishedVersion: restored.version,
        archivedVersions: versions.filter((entry) => entry.state === 'archived').map((entry) => entry.version),
        isWorking: false,
        message: `v${version} 기준으로 롤백했습니다. 새 배포 버전은 v${restored.version}입니다.`,
      });
    } catch (error) {
      setReleaseState((current) => ({
        ...current,
        isWorking: false,
        message: error instanceof Error ? error.message : '롤백하지 못했습니다.',
      }));
    }
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
      releaseState={releaseState}
      onSaveDraft={() => void saveDraft()}
      onPublishDraft={() => void publishDraft()}
      onRollback={(version) => void rollbackConfig(version)}
    />
  );
}
