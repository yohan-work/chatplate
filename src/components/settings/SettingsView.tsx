import { Bell, Clock, RotateCcw, ShieldCheck } from 'lucide-react';
import type { BotConfig } from '../../types/chatbot';
import { Avatar } from '../common/Avatar';

interface SettingsViewProps {
  botConfig: BotConfig;
  botId: string;
  botOptions: Record<string, BotConfig>;
  showDevBotSelector: boolean;
  unknownQuestions: string[];
  onBotChange: (botId: string) => void;
  onReset: () => void;
}

export function SettingsView({
  botConfig,
  botId,
  botOptions,
  showDevBotSelector,
  unknownQuestions,
  onBotChange,
  onReset,
}: SettingsViewProps) {
  return (
    <div className="view-stack">
      <section className="settings-profile">
        <Avatar name={botConfig.bot.name} src={botConfig.bot.avatarUrl} />
        <div>
          <h3>{botConfig.bot.name}</h3>
          <p>{botConfig.bot.description}</p>
        </div>
      </section>

      {showDevBotSelector ? (
        <label className="field-label">
          <span>샘플 bot data</span>
          <select value={botId} onChange={(event) => onBotChange(event.target.value)}>
            {Object.entries(botOptions).map(([id, config]) => (
              <option key={id} value={id}>
                {config.bot.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="settings-list">
        <div className="settings-row">
          <Bell size={18} aria-hidden="true" />
          <span>알림</span>
          <strong>켜짐</strong>
        </div>
        <div className="settings-row">
          <Clock size={18} aria-hidden="true" />
          <span>운영시간</span>
          <strong>{botConfig.operation.csHours}</strong>
        </div>
        <div className="settings-row">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>개인정보/이용 안내</span>
          <strong>보기</strong>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title">
          <h3>문의 채널</h3>
        </div>
        <div className="settings-channels">
          {botConfig.contactChannels.map((channel) => (
            <span key={channel.id}>{channel.label}</span>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title">
          <h3>답변 실패 질문</h3>
          <span>{unknownQuestions.length}개</span>
        </div>
        <p className="muted-text">
          {unknownQuestions.at(-1) ?? '아직 수집된 질문이 없습니다. fallback이 발생하면 여기에 기록됩니다.'}
        </p>
      </section>

      <button className="secondary-button" type="button" onClick={onReset}>
        <RotateCcw size={17} aria-hidden="true" />
        대화 초기화
      </button>
    </div>
  );
}
