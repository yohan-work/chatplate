import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Clock,
  ListChecks,
  MessageSquareWarning,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import type { AdminPanelView, BotConfig, BotConfigMap, KnowledgeItem, Notice, QuickReply } from '../../types/chatbot';
import {
  createEmptyKnowledge,
  createEmptyNotice,
  createQuickReply,
  formatCommaList,
  parseCommaList,
  removeKnowledgeItem,
} from '../../utils/adminBotConfig';
import { ChatbotLauncher } from '../widget/ChatbotLauncher';
import { ChatbotWidget } from '../widget/ChatbotWidget';

interface AdminWorkspaceProps {
  botConfigs: BotConfigMap;
  selectedBotId: string;
  unknownQuestions: string[];
  onSelectBot: (botId: string) => void;
  onUpdateBotConfig: (updater: (config: BotConfig) => BotConfig) => void;
  onResetBot: () => void;
  onUnknownQuestion: (question: string) => void;
}

const panelItems: Array<{ id: AdminPanelView; label: string; icon: typeof Bot }> = [
  { id: 'bot', label: '기본 정보', icon: Bot },
  { id: 'operation', label: '운영시간', icon: Clock },
  { id: 'notices', label: '공지', icon: Bell },
  { id: 'knowledge', label: 'FAQ', icon: Search },
  { id: 'quickReplies', label: '추천 질문', icon: ListChecks },
  { id: 'logs', label: '실패 질문', icon: MessageSquareWarning },
];

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminSidebar({
  botConfigs,
  selectedBotId,
  activeView,
  onSelectBot,
  onChangeView,
  onResetBot,
}: {
  botConfigs: BotConfigMap;
  selectedBotId: string;
  activeView: AdminPanelView;
  onSelectBot: (botId: string) => void;
  onChangeView: (view: AdminPanelView) => void;
  onResetBot: () => void;
}) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand__mark">
          <Settings size={18} aria-hidden="true" />
        </span>
        <div>
          <strong>Chatplate Admin</strong>
          <span>봇 설정과 실제 위젯 미리보기</span>
        </div>
      </div>

      <label className="admin-field">
        <span>관리할 봇</span>
        <select value={selectedBotId} onChange={(event) => onSelectBot(event.target.value)}>
          {Object.entries(botConfigs).map(([id, config]) => (
            <option key={id} value={id}>
              {config.bot.name}
            </option>
          ))}
        </select>
      </label>

      <nav className="admin-nav" aria-label="관리 메뉴">
        {panelItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={activeView === item.id ? 'admin-nav__item is-active' : 'admin-nav__item'}
              type="button"
              onClick={() => onChangeView(item.id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button className="admin-reset-button" type="button" onClick={onResetBot}>
        <RotateCcw size={16} aria-hidden="true" />
        원본 데이터로 복원
      </button>
    </aside>
  );
}

function BotSettingsForm({
  config,
  onUpdate,
}: {
  config: BotConfig;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const updateBot = (field: keyof BotConfig['bot'], value: string) => {
    onUpdate((current) => ({ ...current, bot: { ...current.bot, [field]: value } }));
  };

  const updateTheme = (field: keyof BotConfig['theme'], value: string) => {
    onUpdate((current) => ({ ...current, theme: { ...current.theme, [field]: value } }));
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="기본 정보" description="실제 사용자 챗봇에 표시되는 이름과 홈 문구를 관리합니다." />
      <div className="admin-form-grid">
        <TextField label="봇 이름" value={config.bot.name} onChange={(value) => updateBot('name', value)} />
        <TextField label="홈 타이틀" value={config.theme.homeTitle} onChange={(value) => updateTheme('homeTitle', value)} />
        <TextField label="서비스 타이틀" value={config.bot.title} onChange={(value) => updateBot('title', value)} />
        <TextField label="대표 색상" value={config.theme.primaryColor} onChange={(value) => updateTheme('primaryColor', value)} />
      </div>
      <TextAreaField label="설명" value={config.bot.description} rows={3} onChange={(value) => updateBot('description', value)} />
      <TextAreaField label="첫 인사말" value={config.bot.greeting} onChange={(value) => updateBot('greeting', value)} />
      <TextAreaField label="Fallback 메시지" value={config.bot.fallbackMessage} onChange={(value) => updateBot('fallbackMessage', value)} />
      <TextAreaField label="하단 안내 문구" value={config.bot.disclaimer} onChange={(value) => updateBot('disclaimer', value)} />
    </section>
  );
}

function OperationSettingsForm({
  config,
  onUpdate,
}: {
  config: BotConfig;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const updateOperation = (field: keyof BotConfig['operation'], value: string) => {
    onUpdate((current) => ({ ...current, operation: { ...current.operation, [field]: value } }));
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="운영시간" description="자동 응답 시간과 상담 가능 시간을 사용자 위젯에 표시합니다." />
      <TextField label="봇 응답 시간" value={config.operation.botHours} onChange={(value) => updateOperation('botHours', value)} />
      <TextField label="상담 운영시간" value={config.operation.csHours} onChange={(value) => updateOperation('csHours', value)} />
    </section>
  );
}

function NoticeEditor({
  config,
  onUpdate,
}: {
  config: BotConfig;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const [selectedNoticeId, setSelectedNoticeId] = useState(config.notices[0]?.id ?? '');
  const selectedNotice = config.notices.find((notice) => notice.id === selectedNoticeId) ?? config.notices[0];

  const updateNotice = (noticeId: string, patch: Partial<Notice>) => {
    onUpdate((current) => ({
      ...current,
      notices: current.notices.map((notice) => (notice.id === noticeId ? { ...notice, ...patch } : notice)),
    }));
  };

  const addNotice = () => {
    const notice = createEmptyNotice();
    setSelectedNoticeId(notice.id);
    onUpdate((current) => ({ ...current, notices: [notice, ...current.notices] }));
  };

  const removeNotice = (noticeId: string) => {
    onUpdate((current) => ({ ...current, notices: current.notices.filter((notice) => notice.id !== noticeId) }));
    setSelectedNoticeId('');
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="공지" description="홈 화면과 공지 상세에 노출되는 안내를 관리합니다." actionLabel="공지 추가" onAction={addNotice} />
      <div className="admin-list-layout">
        <div className="admin-item-list">
          {config.notices.map((notice) => (
            <button
              key={notice.id}
              className={selectedNotice?.id === notice.id ? 'admin-list-item is-active' : 'admin-list-item'}
              type="button"
              onClick={() => setSelectedNoticeId(notice.id)}
            >
              <strong>{notice.title}</strong>
              <span>{notice.summary}</span>
            </button>
          ))}
        </div>
        {selectedNotice ? (
          <div className="admin-editor-card">
            <TextField label="제목" value={selectedNotice.title} onChange={(value) => updateNotice(selectedNotice.id, { title: value })} />
            <TextAreaField label="요약" value={selectedNotice.summary} rows={3} onChange={(value) => updateNotice(selectedNotice.id, { summary: value })} />
            <TextAreaField label="본문" value={selectedNotice.content} rows={6} onChange={(value) => updateNotice(selectedNotice.id, { content: value })} />
            <TextField label="작성 시점" value={selectedNotice.createdAt} onChange={(value) => updateNotice(selectedNotice.id, { createdAt: value })} />
            <label className="admin-check">
              <input
                type="checkbox"
                checked={selectedNotice.unread}
                onChange={(event) => updateNotice(selectedNotice.id, { unread: event.target.checked })}
              />
              <span>안 읽은 알림으로 표시</span>
            </label>
            <button className="admin-danger-button" type="button" onClick={() => removeNotice(selectedNotice.id)}>
              <Trash2 size={15} aria-hidden="true" />
              공지 삭제
            </button>
          </div>
        ) : (
          <EmptyState text="등록된 공지가 없습니다." />
        )}
      </div>
    </section>
  );
}

function KnowledgeEditor({
  config,
  onUpdate,
}: {
  config: BotConfig;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(config.knowledge[0]?.id ?? '');
  const selectedKnowledge = config.knowledge.find((item) => item.id === selectedKnowledgeId) ?? config.knowledge[0];
  const defaultCategoryId = config.categories[0]?.id ?? 'general';

  const updateKnowledge = (knowledgeId: string, patch: Partial<KnowledgeItem>) => {
    onUpdate((current) => ({
      ...current,
      knowledge: current.knowledge.map((item) => (item.id === knowledgeId ? { ...item, ...patch } : item)),
    }));
  };

  const addKnowledge = () => {
    const item = createEmptyKnowledge(defaultCategoryId);
    setSelectedKnowledgeId(item.id);
    onUpdate((current) => ({ ...current, knowledge: [item, ...current.knowledge] }));
  };

  const removeKnowledge = (knowledgeId: string) => {
    onUpdate((current) => removeKnowledgeItem(current, knowledgeId));
    setSelectedKnowledgeId('');
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="FAQ / Knowledge" description="사용자 질문과 가장 가까운 답변을 찾는 원본 데이터를 관리합니다." actionLabel="FAQ 추가" onAction={addKnowledge} />
      <div className="admin-list-layout">
        <div className="admin-item-list">
          {config.knowledge.map((item) => (
            <button
              key={item.id}
              className={selectedKnowledge?.id === item.id ? 'admin-list-item is-active' : 'admin-list-item'}
              type="button"
              onClick={() => setSelectedKnowledgeId(item.id)}
            >
              <strong>{item.question}</strong>
              <span>{item.keywords.join(', ') || '키워드 없음'}</span>
            </button>
          ))}
        </div>
        {selectedKnowledge ? (
          <div className="admin-editor-card">
            <TextField label="질문" value={selectedKnowledge.question} onChange={(value) => updateKnowledge(selectedKnowledge.id, { question: value })} />
            <label className="admin-field">
              <span>카테고리</span>
              <select value={selectedKnowledge.categoryId} onChange={(event) => updateKnowledge(selectedKnowledge.id, { categoryId: event.target.value })}>
                {config.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="키워드" value={formatCommaList(selectedKnowledge.keywords)} onChange={(value) => updateKnowledge(selectedKnowledge.id, { keywords: parseCommaList(value) })} />
            <TextField label="별칭 질문" value={formatCommaList(selectedKnowledge.aliases)} onChange={(value) => updateKnowledge(selectedKnowledge.id, { aliases: parseCommaList(value) })} />
            <TextAreaField label="답변" value={selectedKnowledge.answer} rows={7} onChange={(value) => updateKnowledge(selectedKnowledge.id, { answer: value })} />
            <label className="admin-field">
              <span>우선순위</span>
              <input
                type="number"
                min="0"
                max="10"
                value={selectedKnowledge.priority}
                onChange={(event) => updateKnowledge(selectedKnowledge.id, { priority: Number(event.target.value) })}
              />
            </label>
            <button className="admin-danger-button" type="button" onClick={() => removeKnowledge(selectedKnowledge.id)}>
              <Trash2 size={15} aria-hidden="true" />
              FAQ 삭제
            </button>
          </div>
        ) : (
          <EmptyState text="등록된 FAQ가 없습니다." />
        )}
      </div>
    </section>
  );
}

function QuickReplyEditor({
  config,
  onUpdate,
}: {
  config: BotConfig;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const knowledgeById = useMemo(() => new Map(config.knowledge.map((item) => [item.id, item])), [config.knowledge]);

  const updateReply = (index: number, patch: Partial<QuickReply>) => {
    onUpdate((current) => ({
      ...current,
      quickReplies: current.quickReplies.map((reply, replyIndex) => (replyIndex === index ? { ...reply, ...patch } : reply)),
    }));
  };

  const addReply = () => {
    const firstUnused = config.knowledge.find((item) => !config.quickReplies.some((reply) => reply.knowledgeId === item.id));
    if (!firstUnused) return;
    onUpdate((current) => ({ ...current, quickReplies: [...current.quickReplies, createQuickReply(firstUnused)] }));
  };

  const removeReply = (index: number) => {
    onUpdate((current) => ({ ...current, quickReplies: current.quickReplies.filter((_, replyIndex) => replyIndex !== index) }));
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="추천 질문" description="사용자 챗봇 홈과 대화방에 표시할 빠른 질문을 관리합니다." actionLabel="추천 질문 추가" onAction={addReply} />
      <div className="quick-editor-list">
        {config.quickReplies.map((reply, index) => (
          <div className="quick-editor-row" key={`${reply.knowledgeId}-${index}`}>
            <TextField label="라벨" value={reply.label} onChange={(value) => updateReply(index, { label: value })} />
            <label className="admin-field">
              <span>연결 FAQ</span>
              <select value={reply.knowledgeId} onChange={(event) => updateReply(index, { knowledgeId: event.target.value })}>
                {config.knowledge.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.question}
                  </option>
                ))}
              </select>
            </label>
            <p>{knowledgeById.get(reply.knowledgeId)?.answer ?? '연결된 FAQ가 없습니다.'}</p>
            <button className="admin-danger-button" type="button" onClick={() => removeReply(index)}>
              <Trash2 size={15} aria-hidden="true" />
              삭제
            </button>
          </div>
        ))}
        {config.quickReplies.length === 0 ? <EmptyState text="등록된 추천 질문이 없습니다." /> : null}
      </div>
    </section>
  );
}

function UnknownQuestionsPanel({ questions }: { questions: string[] }) {
  return (
    <section className="admin-panel">
      <PanelHeader title="답변 실패 질문" description="사용자가 fallback을 받은 질문을 봇별로 수집합니다." />
      {questions.length > 0 ? (
        <div className="unknown-list">
          {questions.map((question, index) => (
            <div className="unknown-item" key={`${question}-${index}`}>
              <span>{index + 1}</span>
              <p>{question}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="아직 실패 질문이 없습니다. 미리보기에서 알 수 없는 질문을 입력하면 여기에 표시됩니다." />
      )}
    </section>
  );
}

function PanelHeader({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <header className="admin-panel__header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button className="admin-add-button" type="button" onClick={onAction}>
          <Plus size={15} aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </header>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="admin-empty">{text}</p>;
}

function renderActivePanel(
  activeView: AdminPanelView,
  config: BotConfig,
  unknownQuestions: string[],
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void,
) {
  if (activeView === 'bot') return <BotSettingsForm config={config} onUpdate={onUpdate} />;
  if (activeView === 'operation') return <OperationSettingsForm config={config} onUpdate={onUpdate} />;
  if (activeView === 'notices') return <NoticeEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'knowledge') return <KnowledgeEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'quickReplies') return <QuickReplyEditor config={config} onUpdate={onUpdate} />;
  return <UnknownQuestionsPanel questions={unknownQuestions} />;
}

export function AdminWorkspace({
  botConfigs,
  selectedBotId,
  unknownQuestions,
  onSelectBot,
  onUpdateBotConfig,
  onResetBot,
  onUnknownQuestion,
}: AdminWorkspaceProps) {
  const [activeView, setActiveView] = useState<AdminPanelView>('bot');
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const selectedConfig = botConfigs[selectedBotId];
  const unreadCount = selectedConfig.notices.filter((notice) => notice.unread).length;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1100px)');
    const syncPreviewState = () => setIsPreviewOpen(!mediaQuery.matches);

    syncPreviewState();
    mediaQuery.addEventListener('change', syncPreviewState);
    return () => mediaQuery.removeEventListener('change', syncPreviewState);
  }, []);

  return (
    <main className="admin-workspace">
      <AdminSidebar
        botConfigs={botConfigs}
        selectedBotId={selectedBotId}
        activeView={activeView}
        onSelectBot={onSelectBot}
        onChangeView={setActiveView}
        onResetBot={onResetBot}
      />

      <div className="admin-content">{renderActivePanel(activeView, selectedConfig, unknownQuestions, onUpdateBotConfig)}</div>

      <aside className="widget-preview" aria-label="실제 사용자 챗봇 미리보기">
        <div className="widget-preview__header">
          <div>
            <span>Live preview</span>
            <strong>{selectedConfig.bot.name}</strong>
          </div>
          <small>사용자에게 보이는 챗봇</small>
        </div>
        <div className="widget-preview__stage">
          <ChatbotLauncher
            isOpen={isPreviewOpen}
            unreadCount={unreadCount}
            onToggle={() => setIsPreviewOpen((current) => !current)}
          />
          <ChatbotWidget
            botConfig={selectedConfig}
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            onUnknownQuestion={onUnknownQuestion}
          />
        </div>
      </aside>
    </main>
  );
}
