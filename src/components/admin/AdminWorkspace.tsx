import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Clock,
  Inbox,
  ListChecks,
  LogOut,
  MessageCircle,
  MessageSquareWarning,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { searchKnowledge } from '../../engine/searchKnowledge';
import { evaluateSearchDataset, type EvaluationMetrics } from '../../engine/evaluateSearchDataset';
import { validateSmallTalkConfig } from '../../engine/resolveConversation';
import { resolveSmallTalkConfig } from '../../data/smallTalkDefaults';
import type {
  AdminPanelView,
  AdminProfile,
  BotConfig,
  BotConfigMap,
  KnowledgeItem,
  Notice,
  QuickReply,
  SmallTalkRule,
  SupportAuditEvent,
  SupportConversation,
  SupportConversationBundle,
  SupportInternalNote,
  SupportSavedReply,
} from '../../types/chatbot';
import {
  createEmptyKnowledge,
  createEmptyNotice,
  createQuickReply,
  formatCommaList,
  parseCommaList,
  removeKnowledgeItem,
} from '../../utils/adminBotConfig';
import { clearConversationEvents, loadConversationEvents } from '../../utils/conversationEvents';
import { conversationEventsToCsv, parseBotConfigJson, stringifyJson } from '../../utils/dataPortability';
import { clearTickets, loadTickets, ticketsToCsv } from '../../utils/ticketStorage';
import { createClientMessageId, type ChatRepository } from '../../services/chatRepository';
import { getChatRepository } from '../../services/getChatRepository';
import { LocalChatRepository } from '../../services/localChatRepository';
import { ChatbotLauncher } from '../widget/ChatbotLauncher';
import { ChatbotWidget } from '../widget/ChatbotWidget';

interface AdminWorkspaceProps {
  botConfigs: BotConfigMap;
  selectedBotId: string;
  unknownQuestions: string[];
  onSelectBot: (botId: string) => void;
  onUpdateBotConfig: (updater: (config: BotConfig) => BotConfig) => void;
  onReplaceBotConfigs: (configs: BotConfigMap) => void;
  onResetBot: () => void;
  onUnknownQuestion: (question: string) => void;
  releaseState: {
    draftVersion?: number;
    publishedVersion?: number;
    isWorking: boolean;
    message?: string;
    archivedVersions?: number[];
  };
  onSaveDraft: () => void;
  onPublishDraft: () => void;
  onRollback: (version: number) => void;
}

const panelItems: Array<{ id: AdminPanelView; label: string; icon: typeof Bot }> = [
  { id: 'bot', label: '기본 정보', icon: Bot },
  { id: 'operation', label: '운영시간', icon: Clock },
  { id: 'notices', label: '공지', icon: Bell },
  { id: 'knowledge', label: 'FAQ', icon: Search },
  { id: 'quickReplies', label: '추천 질문', icon: ListChecks },
  { id: 'smallTalk', label: '일반 대화', icon: MessageCircle },
  { id: 'quality', label: '검색 품질', icon: Sparkles },
  { id: 'tickets', label: '문의함', icon: Inbox },
  { id: 'team', label: '상담원', icon: Users },
  { id: 'data', label: '데이터', icon: Upload },
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
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  readOnly?: boolean;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <textarea value={value} rows={rows} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminLogin({
  repository,
  onAuthenticated,
}: {
  repository: ChatRepository;
  onAuthenticated: (profile: AdminProfile) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <main className="admin-login">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setIsSubmitting(true);
          setError(undefined);
          void repository.signInAdmin(email.trim(), password)
            .then(onAuthenticated)
            .catch((nextError: unknown) => {
              setError(nextError instanceof Error ? nextError.message : '로그인하지 못했습니다.');
            })
            .finally(() => setIsSubmitting(false));
        }}
      >
        <span className="admin-brand__mark"><Settings size={20} aria-hidden="true" /></span>
        <h1>Chatplate Admin</h1>
        <p>등록된 운영자 계정으로 로그인해 주세요.</p>
        {error ? <div className="admin-callout admin-callout--error" role="alert">{error}</div> : null}
        <label className="admin-field">
          <span>이메일</span>
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>비밀번호</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? '로그인 중…' : '로그인'}</button>
      </form>
    </main>
  );
}

function AdminSidebar({
  botConfigs,
  selectedBotId,
  activeView,
  onSelectBot,
  onChangeView,
  onResetBot,
  admin,
  onSignOut,
}: {
  botConfigs: BotConfigMap;
  selectedBotId: string;
  activeView: AdminPanelView;
  onSelectBot: (botId: string) => void;
  onChangeView: (view: AdminPanelView) => void;
  onResetBot: () => void;
  admin: AdminProfile;
  onSignOut: () => void;
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
      <div className="admin-account">
        <span>{admin.displayName}</span>
        <small>{admin.role === 'owner' ? '소유자' : '상담원'}</small>
        <button type="button" onClick={onSignOut} aria-label="관리자 로그아웃">
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
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
  const updateOperation = (field: 'botHours' | 'csHours', value: string) => {
    onUpdate((current) => ({ ...current, operation: { ...current.operation, [field]: value } }));
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="운영시간" description="자동 응답 시간과 상담 가능 시간을 사용자 위젯에 표시합니다." />
      <TextField label="봇 응답 시간" value={config.operation.botHours} onChange={(value) => updateOperation('botHours', value)} />
      <TextField label="상담 운영시간" value={config.operation.csHours} onChange={(value) => updateOperation('csHours', value)} />
      <TextField
        label="최초 답변 목표(운영시간 기준 분)"
        value={String(config.operation.supportSchedule?.firstResponseTargetMinutes ?? 240)}
        onChange={(value) => onUpdate((current) => ({
          ...current,
          operation: {
            ...current.operation,
            supportSchedule: {
              timezone: current.operation.supportSchedule?.timezone ?? 'Asia/Seoul',
              weekly: current.operation.supportSchedule?.weekly ?? {},
              holidays: current.operation.supportSchedule?.holidays ?? [],
              firstResponseTargetMinutes: Math.max(1, Number(value) || 240),
            },
          },
        }))}
      />
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
            <TextField label="태그" value={formatCommaList(selectedKnowledge.tags ?? [])} onChange={(value) => updateKnowledge(selectedKnowledge.id, { tags: parseCommaList(value) })} />
            <TextField
              label="제외 키워드"
              value={formatCommaList(selectedKnowledge.negativeKeywords ?? [])}
              onChange={(value) => updateKnowledge(selectedKnowledge.id, { negativeKeywords: parseCommaList(value) })}
            />
            <TextAreaField label="답변" value={selectedKnowledge.answer} rows={7} onChange={(value) => updateKnowledge(selectedKnowledge.id, { answer: value })} />
            <label className="admin-field">
              <span>상태</span>
              <select
                value={selectedKnowledge.status ?? 'active'}
                onChange={(event) => updateKnowledge(selectedKnowledge.id, { status: event.target.value as KnowledgeItem['status'] })}
              >
                <option value="active">active</option>
                <option value="draft">draft</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <TextField label="출처" value={selectedKnowledge.source ?? ''} onChange={(value) => updateKnowledge(selectedKnowledge.id, { source: value })} />
            <label className="admin-check">
              <input
                type="checkbox"
                checked={Boolean(selectedKnowledge.handoffRecommended)}
                onChange={(event) => updateKnowledge(selectedKnowledge.id, { handoffRecommended: event.target.checked })}
              />
              <span>상담원 연결 권장</span>
            </label>
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

function SmallTalkEditor({
  config,
  onUpdate,
}: {
  config: BotConfig;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const smallTalk = useMemo(() => resolveSmallTalkConfig(config.bot, config.smallTalk), [config.bot, config.smallTalk]);
  const validationErrors = useMemo(() => validateSmallTalkConfig(smallTalk), [smallTalk]);

  const updateConfig = (enabled: boolean) => {
    onUpdate((current) => {
      const currentSmallTalk = resolveSmallTalkConfig(current.bot, current.smallTalk);
      return { ...current, smallTalk: { ...currentSmallTalk, enabled } };
    });
  };

  const updateRule = (ruleId: string, patch: Partial<SmallTalkRule>) => {
    onUpdate((current) => {
      const currentSmallTalk = resolveSmallTalkConfig(current.bot, current.smallTalk);
      return {
        ...current,
        smallTalk: {
          ...currentSmallTalk,
          rules: currentSmallTalk.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
        },
      };
    });
  };

  return (
    <section className="admin-panel">
      <PanelHeader
        title="일반 대화"
        description="FAQ 검색 전에 처리할 인사·감사·도움말·상담원 요청 등의 고정 응답을 관리합니다."
      />
      <label className="admin-check">
        <input type="checkbox" checked={smallTalk.enabled} onChange={(event) => updateConfig(event.target.checked)} />
        <span>일반 대화 자동 응답 사용</span>
      </label>

      {validationErrors.length > 0 ? (
        <div className="smalltalk-errors" role="alert">
          <strong>데이터를 확인해 주세요.</strong>
          {validationErrors.map((error) => <span key={error}>{error}</span>)}
        </div>
      ) : null}

      <div className="smalltalk-grid">
        {smallTalk.rules.map((rule) => (
          <article className="smalltalk-card" key={rule.id}>
            <div className="smalltalk-card__header">
              <div>
                <strong>{rule.label}</strong>
                <span>{rule.intentId} · 발화 {rule.utterances.length}개</span>
              </div>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                />
                <span>활성</span>
              </label>
            </div>
            <TextAreaField
              label="응답 문구"
              value={rule.response}
              rows={4}
              onChange={(value) => updateRule(rule.id, { response: value })}
            />
            <TextAreaField
              label="인식 발화 · 쉼표 또는 줄바꿈으로 구분"
              value={rule.utterances.join(', ')}
              rows={5}
              onChange={(value) => updateRule(rule.id, { utterances: parseCommaList(value.replace(/\n/g, ',')) })}
            />
            <div className="smalltalk-options">
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={rule.showSuggestions}
                  onChange={(event) => updateRule(rule.id, { showSuggestions: event.target.checked })}
                />
                <span>추천 질문 표시</span>
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={rule.handoffCta}
                  onChange={(event) => updateRule(rule.id, { handoffCta: event.target.checked })}
                />
                <span>상담 연결 표시</span>
              </label>
            </div>
          </article>
        ))}
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

function SearchQualityPanel({
  config,
  unknownQuestions,
  onUpdate,
}: {
  config: BotConfig;
  unknownQuestions: string[];
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const [query, setQuery] = useState(unknownQuestions[0] ?? '');
  const [eventVersion, setEventVersion] = useState(0);
  const [evaluation, setEvaluation] = useState<EvaluationMetrics>();
  const result = useMemo(() => (query.trim() ? searchKnowledge(query, config) : null), [config, query]);
  const matchedItem = result?.item ?? result?.suggestions[0];
  const events = useMemo(() => {
    void eventVersion;
    return loadConversationEvents().filter((event) => event.botId === config.bot.id);
  }, [config.bot.id, eventVersion]);
  const lowConfidenceCount = events.filter((event) => event.confidence === 'low').length;
  const negativeFeedbackCount = events.filter((event) => event.feedback === 'not-helpful').length;
  const smallTalkCount = events.filter((event) => event.interactionType === 'smalltalk' || event.status === 'smalltalk').length;
  const clarificationCount = events.filter((event) => event.routeMode === 'clarification').length;
  const recentRouteEvents = [...events].filter((event) => event.routeMode).slice(-5).reverse();

  const addToKnowledgeField = (field: 'aliases' | 'keywords') => {
    if (!matchedItem || !query.trim()) return;
    onUpdate((current) => ({
      ...current,
      knowledge: current.knowledge.map((item) => {
        if (item.id !== matchedItem.id) return item;
        const values = new Set([...(item[field] ?? []), query.trim()]);
        return { ...item, [field]: [...values], lastUpdated: new Date().toISOString() };
      }),
    }));
  };

  const createFaqFromQuery = () => {
    if (!query.trim()) return;
    const item = {
      ...createEmptyKnowledge(config.categories[0]?.id ?? 'general'),
      question: query.trim(),
      keywords: [],
      aliases: [],
      answer: '답변을 입력하세요.',
      status: 'draft' as const,
      lastUpdated: new Date().toISOString(),
    };
    onUpdate((current) => ({ ...current, knowledge: [item, ...current.knowledge] }));
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="검색 품질" description="질문을 입력해 매칭 결과와 신뢰도, 점수 breakdown을 확인하고 FAQ를 개선합니다." />

      <div className="quality-summary">
        <div>
          <strong>{events.length}</strong>
          <span>검색 이벤트</span>
        </div>
        <div>
          <strong>{lowConfidenceCount}</strong>
          <span>낮은 신뢰도</span>
        </div>
        <div>
          <strong>{negativeFeedbackCount}</strong>
          <span>부정 피드백</span>
        </div>
        <div>
          <strong>{smallTalkCount}</strong>
          <span>일반 대화</span>
        </div>
        <div>
          <strong>{clarificationCount}</strong>
          <span>문맥 확인</span>
        </div>
        <button
          className="admin-reset-button"
          type="button"
          onClick={() => {
            clearConversationEvents();
            setEventVersion((current) => current + 1);
          }}
        >
          로그 초기화
        </button>
        <button
          className="admin-reset-button"
          type="button"
          onClick={() => setEvaluation(evaluateSearchDataset(config, 'test', 50))}
        >
          Holdout 50건 평가
        </button>
      </div>

      {evaluation ? (
        <div className="quality-alternatives">
          <strong>누수 없는 test 평가</strong>
          <span>표본 {evaluation.samples} · top-1 {(evaluation.top1Accuracy * 100).toFixed(1)}%</span>
          <span>top-3 {(evaluation.top3Recall * 100).toFixed(1)}% · MRR {evaluation.meanReciprocalRank.toFixed(3)}</span>
          <span>fallback {(evaluation.fallbackRate * 100).toFixed(1)}%</span>
          {evaluation.failures.slice(0, 3).map((failure) => (
            <span key={`${failure.expectedId}:${failure.query}`}>
              실패: “{failure.query}” → 기대 {failure.expectedId}, 후보 {failure.rankedIds.join(', ') || '없음'}
            </span>
          ))}
        </div>
      ) : null}

      {recentRouteEvents.length ? (
        <div className="quality-alternatives">
          <strong>최근 문맥 라우팅</strong>
          {recentRouteEvents.map((event) => (
            <span key={event.id}>
              {event.routeMode} · {event.routeReason} · 독립 {event.standaloneKnowledgeId ?? '없음'} ({event.standaloneScore ?? 0})
              {' / '}문맥 {event.contextualKnowledgeId ?? '없음'} ({event.contextualScore ?? 0})
              {event.selectedCandidateId ? ` → 선택 ${event.selectedCandidateId}` : ''}
            </span>
          ))}
        </div>
      ) : null}

      <TextField label="테스트 질문" value={query} onChange={setQuery} placeholder="예: 설치랑 요금 알려줘" />

      {result ? (
        <div className="quality-result">
          <div className="quality-result__top">
            <div>
              <span className={`confidence-badge confidence-badge--${result.confidence}`}>{result.confidence}</span>
              <strong>{matchedItem?.question ?? '매칭된 FAQ 없음'}</strong>
              <p>
                score {result.score} · margin {result.scoreMargin ?? 0} · {result.decisionReason ?? '판정 없음'}
              </p>
              <p>{result.matchedFields.join(', ') || 'matched field 없음'}</p>
              {result.matchedUtterance ? <p>가장 가까운 발화: “{result.matchedUtterance}”</p> : null}
            </div>
            <div className="quality-actions">
              <button type="button" onClick={() => addToKnowledgeField('aliases')} disabled={!matchedItem}>
                alias로 추가
              </button>
              <button type="button" onClick={() => addToKnowledgeField('keywords')} disabled={!matchedItem}>
                keyword로 추가
              </button>
              <button type="button" onClick={createFaqFromQuery}>
                새 FAQ 생성
              </button>
            </div>
          </div>

          {result.debugScore ? (
            <div className="score-grid">
              {Object.entries(result.debugScore).map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {result.alternatives.length ? (
            <div className="quality-alternatives">
              <strong>후보 질문</strong>
              {result.alternatives.map((item) => (
                <span key={item.id}>{item.question}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState text="테스트할 질문을 입력하세요." />
      )}

      {unknownQuestions.length ? (
        <div className="quality-alternatives">
          <strong>최근 실패 질문</strong>
          {unknownQuestions.slice(-5).map((question, index) => (
            <button key={`${question}-${index}`} type="button" onClick={() => setQuery(question)}>
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function downloadTextFile(filename: string, content: string, mimeType = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DataPortabilityPanel({
  botConfigs,
  selectedBotId,
  onReplaceBotConfigs,
}: {
  botConfigs: BotConfigMap;
  selectedBotId: string;
  onReplaceBotConfigs: (configs: BotConfigMap) => void;
}) {
  const [importStatus, setImportStatus] = useState('');
  const selectedConfig = botConfigs[selectedBotId];
  const events = loadConversationEvents();
  const tickets = loadTickets();
  const scriptSnippet = `<script type="module" src="/widget.js" data-bot-id="${selectedBotId}"></script>`;
  const initSnippet = `<script type="module" src="/widget.js" data-auto-init="false"></script>
<script type="module">
  await window.ChatplateReady;
  window.Chatplate.init({ botId: "${selectedBotId}" });
</script>`;

  const copySnippet = async (snippet: string) => {
    await navigator.clipboard?.writeText(snippet);
    setImportStatus('임베드 코드가 클립보드에 복사되었습니다.');
  };

  const handleImport = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseBotConfigJson(String(reader.result ?? ''));
      if (!result.configs) {
        setImportStatus(`가져오기 실패: ${result.errors.slice(0, 3).join(' / ')}`);
        return;
      }

      onReplaceBotConfigs({ ...botConfigs, ...result.configs });
      setImportStatus(`${Object.keys(result.configs).length}개 bot config를 가져왔습니다.`);
    };
    reader.readAsText(file);
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="데이터 / 임베드" description="관리 데이터를 파일로 옮기고, 외부 사이트에 붙일 위젯 코드를 확인합니다." />

      <div className="data-grid">
        <div className="data-card">
          <h3>Bot config 내보내기</h3>
          <p>현재 선택한 봇 또는 전체 봇 데이터를 JSON 파일로 저장합니다.</p>
          <div className="data-actions">
            <button type="button" onClick={() => downloadTextFile(`${selectedBotId}.json`, stringifyJson(selectedConfig))}>
              현재 봇 JSON
            </button>
            <button type="button" onClick={() => downloadTextFile('chatplate-bot-configs.json', stringifyJson(botConfigs))}>
              전체 JSON
            </button>
          </div>
        </div>

        <div className="data-card">
          <h3>Bot config 가져오기</h3>
          <p>단일 bot config 또는 bot config map JSON을 가져와 localStorage에 저장합니다.</p>
          <label className="import-button">
            <input type="file" accept="application/json,.json" onChange={(event) => handleImport(event.target.files?.[0])} />
            JSON 파일 선택
          </label>
          {importStatus ? <p className="data-status">{importStatus}</p> : null}
        </div>

        <div className="data-card">
          <h3>운영 로그 내보내기</h3>
          <p>질문 원문이 포함될 수 있습니다. 외부 공유 전 개인정보 포함 여부를 확인하세요.</p>
          <div className="data-actions">
            <button type="button" onClick={() => downloadTextFile('chatplate-events.json', stringifyJson(events))}>
              로그 JSON
            </button>
            <button type="button" onClick={() => downloadTextFile('chatplate-events.csv', conversationEventsToCsv(events), 'text/csv')}>
              로그 CSV
            </button>
            <button
              type="button"
              onClick={() => {
                clearConversationEvents();
                setImportStatus('운영 로그를 초기화했습니다.');
              }}
            >
              로그 초기화
            </button>
          </div>
        </div>

        <div className="data-card">
          <h3>상담 티켓 내보내기</h3>
          <p>사용자가 남긴 이름, 연락처, 문의 내용이 포함됩니다. 접근 권한이 있는 관리자만 다루세요.</p>
          <div className="data-actions">
            <button type="button" onClick={() => downloadTextFile('chatplate-tickets.json', stringifyJson(tickets))}>
              티켓 JSON
            </button>
            <button type="button" onClick={() => downloadTextFile('chatplate-tickets.csv', ticketsToCsv(tickets), 'text/csv')}>
              티켓 CSV
            </button>
            <button
              type="button"
              onClick={() => {
                clearTickets();
                setImportStatus('상담 티켓을 초기화했습니다.');
              }}
            >
              티켓 초기화
            </button>
          </div>
        </div>

        <div className="data-card data-card--wide">
          <h3>외부 사이트 삽입 코드</h3>
          <p>정적 빌드 후 생성되는 `widget.js`를 외부 페이지에 삽입합니다.</p>
          <pre>{scriptSnippet}</pre>
          <div className="data-actions">
            <button type="button" onClick={() => copySnippet(scriptSnippet)}>
              기본 코드 복사
            </button>
            <button type="button" onClick={() => copySnippet(initSnippet)}>
              고급 코드 복사
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TicketInboxPanel({
  config,
  repository,
  admin,
  onUpdate,
}: {
  config: BotConfig;
  repository: ChatRepository;
  admin: AdminProfile;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [bundle, setBundle] = useState<SupportConversationBundle>();
  const [notes, setNotes] = useState<SupportInternalNote[]>([]);
  const [auditEvents, setAuditEvents] = useState<SupportAuditEvent[]>([]);
  const [savedReplies, setSavedReplies] = useState<SupportSavedReply[]>([]);
  const [members, setMembers] = useState<AdminProfile[]>([]);
  const [transferTo, setTransferTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SupportConversation['status']>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [reply, setReply] = useState('');
  const [savedReplyTitle, setSavedReplyTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [isWorking, setIsWorking] = useState(false);

  const refreshInbox = useCallback(async () => {
    const page = await repository.queryConversations({
      botId: config.bot.id,
      assignment: assignmentFilter,
      adminId: admin.id,
      search: deferredSearchQuery,
      limit: 100,
    });
    const next = page.items
      .filter((conversation) => conversation.status !== 'bot_active');
    setConversations(next);
    setSelectedConversationId((current) =>
      next.some((conversation) => conversation.id === current) ? current : next[0]?.id ?? '',
    );
  }, [admin.id, assignmentFilter, config.bot.id, deferredSearchQuery, repository]);

  const refreshSelected = useCallback(async (conversationId: string) => {
    const [nextBundle, nextNotes, nextAuditEvents, nextSavedReplies, nextMembers] = await Promise.all([
      repository.loadConversation(conversationId),
      repository.listInternalNotes(conversationId),
      repository.listAuditEvents(conversationId),
      repository.listSavedReplies(config.bot.id),
      repository.listAdmins(),
    ]);
    setBundle(nextBundle ?? undefined);
    setNotes(nextNotes);
    setAuditEvents(nextAuditEvents);
    setSavedReplies(nextSavedReplies);
    setMembers(nextMembers.filter((member) => member.active));
  }, [config.bot.id, repository]);

  useEffect(() => {
    void refreshInbox().catch((nextError: unknown) => {
      setError(nextError instanceof Error ? nextError.message : '상담 목록을 불러오지 못했습니다.');
    });
    return repository.subscribe({ botId: config.bot.id }, () => {
      void refreshInbox().catch(() => undefined);
    });
  }, [config.bot.id, refreshInbox, repository]);

  useEffect(() => {
    if (!selectedConversationId) {
      setBundle(undefined);
      return;
    }
    void Promise.all([
      refreshSelected(selectedConversationId),
      repository.markRead(selectedConversationId, 'admin'),
    ]).catch((nextError: unknown) => {
      setError(nextError instanceof Error ? nextError.message : '상담 내용을 불러오지 못했습니다.');
    });
    return repository.subscribe({ conversationId: selectedConversationId }, () => {
      void refreshSelected(selectedConversationId).catch(() => undefined);
    });
  }, [refreshSelected, repository, selectedConversationId]);

  const filteredConversations = statusFilter === 'all'
    ? conversations
    : conversations.filter((conversation) => conversation.status === statusFilter);
  const selectedConversation = bundle?.conversation;
  const statusCounts = conversations.reduce<Record<SupportConversation['status'], number>>(
    (counts, conversation) => ({ ...counts, [conversation.status]: counts[conversation.status] + 1 }),
    { bot_active: 0, waiting: 0, human_active: 0, resolved: 0 },
  );
  const statusLabel = (status: SupportConversation['status']) => {
    if (status === 'waiting') return '상담 대기';
    if (status === 'human_active') return '상담 중';
    if (status === 'resolved') return '완료';
    return '자동 안내';
  };
  const canReply = selectedConversation?.status === 'human_active' &&
    selectedConversation.assignedTo === admin.id;

  const runAction = async (action: () => Promise<unknown>) => {
    setIsWorking(true);
    setError(undefined);
    try {
      await action();
      await Promise.all([
        refreshInbox(),
        selectedConversationId ? refreshSelected(selectedConversationId) : Promise.resolve(),
      ]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '상담 작업을 완료하지 못했습니다.');
    } finally {
      setIsWorking(false);
    }
  };

  const createFaqDraft = () => {
    if (!bundle) return;
    const visitorMessages = bundle.messages.filter((message) => message.sender === 'visitor');
    const question = visitorMessages[0]?.text;
    if (!question) {
      setError('FAQ로 만들 고객 질문이 없습니다.');
      return;
    }
    const item = {
      ...createEmptyKnowledge(config.categories[0]?.id ?? 'general'),
      question,
      aliases: visitorMessages.slice(1).map((message) => message.text),
      source: `conversation:${bundle.conversation.id}`,
      status: 'draft' as const,
    };
    onUpdate((current) => ({ ...current, knowledge: [item, ...current.knowledge] }));
    setNote(`FAQ 초안 생성: ${item.id}`);
  };

  return (
    <section className="admin-panel">
      <PanelHeader title="채팅 상담함" description="자동응대에서 인계된 대화를 담당자가 이어서 답변합니다." />
      {error ? <p className="admin-callout admin-callout--error" role="alert">{error}</p> : null}

      <div className="ticket-summary">
        <button className={statusFilter === 'all' ? 'is-active' : ''} type="button" onClick={() => setStatusFilter('all')}>
          전체 <strong>{conversations.length}</strong>
        </button>
        {(['waiting', 'human_active', 'resolved'] as SupportConversation['status'][]).map((status) => (
          <button className={statusFilter === status ? 'is-active' : ''} key={status} type="button" onClick={() => setStatusFilter(status)}>
            {statusLabel(status)} <strong>{statusCounts[status]}</strong>
          </button>
        ))}
      </div>

      <div className="support-inbox-tools">
        <label>
          <Search size={15} aria-hidden="true" />
          <input
            value={searchQuery}
            type="search"
            placeholder="고객명, 연락처, 대화 검색"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <select
          value={assignmentFilter}
          aria-label="담당자 필터"
          onChange={(event) => setAssignmentFilter(event.target.value as typeof assignmentFilter)}
        >
          <option value="all">전체 담당자</option>
          <option value="unassigned">미배정</option>
          <option value="mine">내 상담</option>
        </select>
      </div>

      <div className="admin-list-layout ticket-layout">
        <div className="admin-item-list">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              className={selectedConversationId === conversation.id ? 'admin-list-item ticket-list-item is-active' : 'admin-list-item ticket-list-item'}
              type="button"
              onClick={() => setSelectedConversationId(conversation.id)}
            >
              <span className={`ticket-status ticket-status--${conversation.status}`}>{statusLabel(conversation.status)}</span>
              <strong>{conversation.contact?.name ?? '익명 방문자'}</strong>
              <span>
                {conversation.assignedName ?? '미배정'} · {new Date(conversation.lastMessageAt).toLocaleString('ko-KR')}
              </span>
              {conversation.unreadForAdmins > 0 ? <b className="admin-unread">{conversation.unreadForAdmins}</b> : null}
            </button>
          ))}
          {filteredConversations.length === 0 ? <EmptyState text="조건에 맞는 상담 대화가 없습니다." /> : null}
        </div>

        {selectedConversation && bundle ? (
          <div className="admin-editor-card ticket-detail">
            <div className="ticket-detail__top">
              <div>
                <span>{selectedConversation.id}</span>
                <strong>{selectedConversation.contact?.name ?? '익명 방문자'} 상담</strong>
              </div>
              <span className={`ticket-status ticket-status--${selectedConversation.status}`}>{statusLabel(selectedConversation.status)}</span>
            </div>

            <div className="ticket-meta-grid">
              <div>
                <span>연락처</span>
                <strong>{selectedConversation.contact?.contact ?? '인계 전'}</strong>
              </div>
              <div>
                <span>담당자</span>
                <strong>{selectedConversation.assignedName ?? '미배정'}</strong>
              </div>
              <div>
                <span>인계 사유</span>
                <strong>{selectedConversation.handoffReason ?? '-'}</strong>
              </div>
              <div>
                <span>생성</span>
                <strong>{new Date(selectedConversation.createdAt).toLocaleString('ko-KR')}</strong>
              </div>
            </div>

            <div className="support-thread" aria-live="polite">
              {bundle.messages.map((message) => (
                <article className={`support-thread__message support-thread__message--${message.sender}`} key={message.id}>
                  <span>{message.senderName ?? (message.sender === 'visitor' ? '고객' : message.sender === 'bot' ? '자동 안내' : '시스템')}</span>
                  <p>{message.text}</p>
                  <time>{new Date(message.createdAt).toLocaleString('ko-KR')}</time>
                </article>
              ))}
            </div>

            <div className="support-actions">
              {!selectedConversation.assignedTo && selectedConversation.status === 'waiting' ? (
                <button
                  className="admin-add-button"
                  type="button"
                  disabled={isWorking}
                  onClick={() => void runAction(() => repository.claimConversation(selectedConversation.id, admin))}
                >
                  <UserCheck size={15} aria-hidden="true" /> 담당하기
                </button>
              ) : null}
              {selectedConversation.status === 'human_active' ? (
                <button
                  type="button"
                  disabled={isWorking || (!canReply && admin.role !== 'owner')}
                  onClick={() => void runAction(() => repository.resolveConversation(selectedConversation.id))}
                >
                  상담 완료
                </button>
              ) : null}
              {selectedConversation.assignedTo &&
              (selectedConversation.assignedTo === admin.id || admin.role === 'owner') ? (
                <>
                  <select
                    value={transferTo}
                    aria-label="상담 이관 대상"
                    onChange={(event) => setTransferTo(event.target.value)}
                  >
                    <option value="">담당자 이관</option>
                    {members
                      .filter((member) => member.id !== selectedConversation.assignedTo)
                      .map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={!transferTo || isWorking}
                    onClick={() => {
                      const target = members.find((member) => member.id === transferTo);
                      if (!target) return;
                      setTransferTo('');
                      void runAction(() => repository.transferConversation(selectedConversation.id, admin, target));
                    }}
                  >
                    이관
                  </button>
                </>
              ) : null}
            </div>

            <form
              className="support-reply"
              onSubmit={(event) => {
                event.preventDefault();
                if (!reply.trim() || !selectedConversation) return;
                const body = reply.trim();
                setReply('');
                void runAction(() => repository.appendMessage({
                  conversationId: selectedConversation.id,
                  clientId: createClientMessageId('operator'),
                  sender: 'operator',
                  senderId: admin.id,
                  senderName: admin.displayName,
                  text: body,
                }));
              }}
            >
              <textarea
                value={reply}
                rows={3}
                disabled={!canReply || isWorking}
                placeholder={canReply ? '고객에게 보낼 답변을 입력하세요.' : '담당하기 후 답변할 수 있습니다.'}
                onChange={(event) => setReply(event.target.value)}
              />
              {savedReplies.length ? (
                <select
                  aria-label="저장 답변"
                  defaultValue=""
                  onChange={(event) => {
                    const savedReply = savedReplies.find((entry) => entry.id === event.target.value);
                    if (savedReply) setReply(savedReply.body);
                    event.target.value = '';
                  }}
                >
                  <option value="">저장 답변 불러오기</option>
                  {savedReplies.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}
                </select>
              ) : null}
              <button type="submit" disabled={!canReply || !reply.trim() || isWorking}>
                <Send size={15} aria-hidden="true" /> 답변 보내기
              </button>
              <div className="support-save-reply">
                <input
                  value={savedReplyTitle}
                  placeholder="현재 내용을 저장할 제목"
                  onChange={(event) => setSavedReplyTitle(event.target.value)}
                />
                <button
                  type="button"
                  disabled={!savedReplyTitle.trim() || !reply.trim() || isWorking}
                  onClick={() => {
                    const title = savedReplyTitle.trim();
                    const body = reply.trim();
                    setSavedReplyTitle('');
                    void runAction(() => repository.saveReply(config.bot.id, admin, title, body));
                  }}
                >
                  저장 답변 추가
                </button>
              </div>
            </form>

            <section className="support-notes">
              <strong>내부 메모</strong>
              {notes.map((entry) => (
                <p key={entry.id}><b>{entry.authorName}</b> {entry.text}</p>
              ))}
              <div>
                <input value={note} placeholder="고객에게 보이지 않는 메모" onChange={(event) => setNote(event.target.value)} />
                <button
                  type="button"
                  disabled={!note.trim() || isWorking}
                  onClick={() => {
                    const body = note.trim();
                    setNote('');
                    void runAction(() => repository.appendInternalNote(selectedConversation.id, admin, body));
                  }}
                >
                  메모 저장
                </button>
              </div>
            </section>

            <section className="support-audit">
              <strong>상담 이력</strong>
              {auditEvents.map((event) => (
                <p key={event.id}>
                  <span>{event.action}</span>
                  <time>{new Date(event.createdAt).toLocaleString('ko-KR')}</time>
                </p>
              ))}
              {auditEvents.length === 0 ? <small>기록된 상태 변경이 없습니다.</small> : null}
            </section>

            <button className="admin-add-button" type="button" onClick={createFaqDraft}>
              <Plus size={15} aria-hidden="true" /> FAQ 초안 생성
            </button>
          </div>
        ) : (
          <EmptyState text="상담 대화를 선택해 주세요." />
        )}
      </div>
    </section>
  );
}

function TeamPanel({ repository, admin }: { repository: ChatRepository; admin: AdminProfile }) {
  const [members, setMembers] = useState<AdminProfile[]>([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AdminProfile['role']>('operator');
  const [message, setMessage] = useState<string>();

  const refresh = useCallback(async () => {
    setMembers(await repository.listAdmins());
  }, [repository]);

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : '상담원 목록을 불러오지 못했습니다.');
    });
  }, [refresh]);

  if (admin.role !== 'owner') {
    return (
      <section className="admin-panel">
        <PanelHeader title="상담원 관리" description="소유자만 상담원을 초대하거나 비활성화할 수 있습니다." />
        <EmptyState text="이 화면에 접근할 권한이 없습니다." />
      </section>
    );
  }

  return (
    <section className="admin-panel">
      <PanelHeader title="상담원 관리" description="초기 1~5명 운영팀의 계정과 역할을 관리합니다." />
      {message ? <p className="data-status" role="status">{message}</p> : null}
      <form
        className="team-invite"
        onSubmit={(event) => {
          event.preventDefault();
          if (!email.trim() || !displayName.trim()) return;
          void repository.inviteAdmin(email.trim(), displayName.trim(), role)
            .then(() => {
              setEmail('');
              setDisplayName('');
              setMessage('초대 메일을 요청했습니다.');
              return refresh();
            })
            .catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : '상담원을 초대하지 못했습니다.');
            });
        }}
      >
        <input value={displayName} placeholder="상담원 이름" onChange={(event) => setDisplayName(event.target.value)} />
        <input value={email} type="email" placeholder="name@example.com" onChange={(event) => setEmail(event.target.value)} />
        <select value={role} onChange={(event) => setRole(event.target.value as AdminProfile['role'])}>
          <option value="operator">상담원</option>
          <option value="owner">소유자</option>
        </select>
        <button type="submit">상담원 초대</button>
      </form>
      <div className="team-list">
        {members.map((member) => (
          <article key={member.id}>
            <div>
              <strong>{member.displayName}</strong>
              <span>{member.email} · {member.role === 'owner' ? '소유자' : '상담원'}</span>
            </div>
            <button
              type="button"
              disabled={member.id === admin.id}
              onClick={() => {
                void repository.setAdminActive(member.id, !member.active).then(refresh);
              }}
            >
              {member.active ? '비활성화' : '활성화'}
            </button>
          </article>
        ))}
      </div>
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
  botConfigs: BotConfigMap,
  selectedBotId: string,
  repository: ChatRepository,
  admin: AdminProfile,
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void,
  onReplaceBotConfigs: (configs: BotConfigMap) => void,
) {
  if (activeView === 'bot') return <BotSettingsForm config={config} onUpdate={onUpdate} />;
  if (activeView === 'operation') return <OperationSettingsForm config={config} onUpdate={onUpdate} />;
  if (activeView === 'notices') return <NoticeEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'knowledge') return <KnowledgeEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'quickReplies') return <QuickReplyEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'smallTalk') return <SmallTalkEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'quality') return <SearchQualityPanel config={config} unknownQuestions={unknownQuestions} onUpdate={onUpdate} />;
  if (activeView === 'tickets') return <TicketInboxPanel config={config} repository={repository} admin={admin} onUpdate={onUpdate} />;
  if (activeView === 'team') return <TeamPanel repository={repository} admin={admin} />;
  if (activeView === 'data') return <DataPortabilityPanel botConfigs={botConfigs} selectedBotId={selectedBotId} onReplaceBotConfigs={onReplaceBotConfigs} />;
  return <UnknownQuestionsPanel questions={unknownQuestions} />;
}

export function AdminWorkspace({
  botConfigs,
  selectedBotId,
  unknownQuestions,
  onSelectBot,
  onUpdateBotConfig,
  onReplaceBotConfigs,
  onResetBot,
  onUnknownQuestion,
  releaseState,
  onSaveDraft,
  onPublishDraft,
  onRollback,
}: AdminWorkspaceProps) {
  const [activeView, setActiveView] = useState<AdminPanelView>('bot');
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const repository = useMemo(() => getChatRepository('admin'), []);
  const previewRepository = useMemo(() => {
    const values = new Map<string, string>();
    return new LocalChatRepository({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    });
  }, []);
  const [admin, setAdmin] = useState<AdminProfile | null>();
  const [authError, setAuthError] = useState<string>();
  const selectedConfig = botConfigs[selectedBotId];
  const unreadCount = selectedConfig.notices.filter((notice) => notice.unread).length;

  useEffect(() => {
    void repository.getCurrentAdmin()
      .then(setAdmin)
      .catch((error: unknown) => {
        setAuthError(error instanceof Error ? error.message : '관리자 세션을 확인하지 못했습니다.');
        setAdmin(null);
      });
  }, [repository]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1100px)');
    const syncPreviewState = () => setIsPreviewOpen(!mediaQuery.matches);

    syncPreviewState();
    mediaQuery.addEventListener('change', syncPreviewState);
    return () => mediaQuery.removeEventListener('change', syncPreviewState);
  }, []);

  if (admin === undefined) {
    return <main className="admin-login"><p>{authError ?? '관리자 세션을 확인하고 있습니다…'}</p></main>;
  }
  if (admin === null) {
    return <AdminLogin repository={repository} onAuthenticated={setAdmin} />;
  }

  return (
    <main className="admin-workspace">
      <AdminSidebar
        botConfigs={botConfigs}
        selectedBotId={selectedBotId}
        activeView={activeView}
        onSelectBot={onSelectBot}
        onChangeView={setActiveView}
        onResetBot={onResetBot}
        admin={admin}
        onSignOut={() => {
          void repository.signOutAdmin().finally(() => setAdmin(null));
        }}
      />

      <div className="admin-content">
        <section className="config-release-bar" aria-label="봇 설정 배포">
          <div>
            <strong>고객 노출 버전 {releaseState.publishedVersion ? `v${releaseState.publishedVersion}` : '없음'}</strong>
            <span>
              {releaseState.message ??
                (releaseState.draftVersion ? `저장된 초안 v${releaseState.draftVersion}` : '변경 후 초안을 저장하세요.')}
            </span>
          </div>
          <button type="button" disabled={releaseState.isWorking} onClick={onSaveDraft}>초안 저장</button>
          <button type="button" disabled={releaseState.isWorking} onClick={onPublishDraft}>고객에게 배포</button>
          {releaseState.archivedVersions?.length ? (
            <select
              aria-label="이전 설정으로 롤백"
              defaultValue=""
              disabled={releaseState.isWorking}
              onChange={(event) => {
                if (event.target.value) onRollback(Number(event.target.value));
                event.target.value = '';
              }}
            >
              <option value="">이전 버전 롤백</option>
              {releaseState.archivedVersions.map((version) => (
                <option value={version} key={version}>v{version}</option>
              ))}
            </select>
          ) : null}
        </section>
        {renderActivePanel(
          activeView,
          selectedConfig,
          unknownQuestions,
          botConfigs,
          selectedBotId,
          repository,
          admin,
          onUpdateBotConfig,
          onReplaceBotConfigs,
        )}
      </div>

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
            chatRepository={previewRepository}
          />
        </div>
      </aside>
    </main>
  );
}
