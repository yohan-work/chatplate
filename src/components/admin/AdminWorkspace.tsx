import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Clock,
  Inbox,
  ListChecks,
  MessageSquareWarning,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { searchKnowledge } from '../../engine/searchKnowledge';
import type { AdminPanelView, BotConfig, BotConfigMap, KnowledgeItem, Notice, QuickReply, Ticket, TicketPriority, TicketStatus } from '../../types/chatbot';
import {
  createEmptyKnowledge,
  createEmptyNotice,
  createKnowledgeFromTicket,
  createQuickReply,
  formatCommaList,
  parseCommaList,
  removeKnowledgeItem,
} from '../../utils/adminBotConfig';
import { clearConversationEvents, loadConversationEvents } from '../../utils/conversationEvents';
import { conversationEventsToCsv, parseBotConfigJson, stringifyJson } from '../../utils/dataPortability';
import { clearTickets, loadTickets, ticketsToCsv, ticketStatusLabel, updateTicket } from '../../utils/ticketStorage';
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
}

const panelItems: Array<{ id: AdminPanelView; label: string; icon: typeof Bot }> = [
  { id: 'bot', label: '기본 정보', icon: Bot },
  { id: 'operation', label: '운영시간', icon: Clock },
  { id: 'notices', label: '공지', icon: Bell },
  { id: 'knowledge', label: 'FAQ', icon: Search },
  { id: 'quickReplies', label: '추천 질문', icon: ListChecks },
  { id: 'quality', label: '검색 품질', icon: Sparkles },
  { id: 'tickets', label: '문의함', icon: Inbox },
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
  const result = useMemo(() => (query.trim() ? searchKnowledge(query, config) : null), [config, query]);
  const matchedItem = result?.item;
  const events = useMemo(
    () => loadConversationEvents().filter((event) => event.botId === config.bot.id),
    [config.bot.id, eventVersion],
  );
  const lowConfidenceCount = events.filter((event) => event.confidence === 'low').length;
  const negativeFeedbackCount = events.filter((event) => event.feedback === 'not-helpful').length;

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
      </div>

      <TextField label="테스트 질문" value={query} onChange={setQuery} placeholder="예: 설치랑 요금 알려줘" />

      {result ? (
        <div className="quality-result">
          <div className="quality-result__top">
            <div>
              <span className={`confidence-badge confidence-badge--${result.confidence}`}>{result.confidence}</span>
              <strong>{matchedItem?.question ?? '매칭된 FAQ 없음'}</strong>
              <p>score {result.score} · {result.matchedFields.join(', ') || 'matched field 없음'}</p>
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
  const scriptSnippet = `<script src="/widget.js" data-bot-id="${selectedBotId}"></script>`;
  const initSnippet = `<script src="/widget.js" data-auto-init="false"></script>
<script>
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
  ticketVersion,
  onTicketVersionChange,
  onUpdate,
}: {
  config: BotConfig;
  ticketVersion: number;
  onTicketVersionChange: () => void;
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void;
}) {
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const tickets = useMemo(
    () => loadTickets().filter((ticket) => ticket.botId === config.bot.id),
    [config.bot.id, ticketVersion],
  );
  const filteredTickets = statusFilter === 'all' ? tickets : tickets.filter((ticket) => ticket.status === statusFilter);
  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? filteredTickets[0];

  useEffect(() => {
    if (!selectedTicket && selectedTicketId) setSelectedTicketId('');
  }, [selectedTicket, selectedTicketId]);

  const patchTicket = (ticket: Ticket, patch: Partial<Pick<Ticket, 'status' | 'priority' | 'adminMemo'>>) => {
    updateTicket(ticket.id, patch);
    onTicketVersionChange();
  };

  const createFaqDraft = (ticket: Ticket) => {
    const item = createKnowledgeFromTicket(ticket, config.categories[0]?.id ?? 'general');
    onUpdate((current) => ({ ...current, knowledge: [item, ...current.knowledge] }));
    patchTicket(ticket, {
      status: ticket.status === 'new' ? 'inProgress' : ticket.status,
      adminMemo: [ticket.adminMemo, `FAQ 초안 생성: ${item.id}`].filter(Boolean).join('\n'),
    });
  };

  const statusCounts = tickets.reduce<Record<TicketStatus, number>>(
    (counts, ticket) => ({ ...counts, [ticket.status]: counts[ticket.status] + 1 }),
    { new: 0, inProgress: 0, resolved: 0, onHold: 0 },
  );

  return (
    <section className="admin-panel">
      <PanelHeader title="상담 문의함" description="챗봇이 해결하지 못한 질문과 상담 요청을 티켓으로 처리합니다." />

      <div className="ticket-summary">
        <button className={statusFilter === 'all' ? 'is-active' : ''} type="button" onClick={() => setStatusFilter('all')}>
          전체 <strong>{tickets.length}</strong>
        </button>
        {(['new', 'inProgress', 'resolved', 'onHold'] as TicketStatus[]).map((status) => (
          <button className={statusFilter === status ? 'is-active' : ''} key={status} type="button" onClick={() => setStatusFilter(status)}>
            {ticketStatusLabel(status)} <strong>{statusCounts[status]}</strong>
          </button>
        ))}
      </div>

      <div className="admin-list-layout ticket-layout">
        <div className="admin-item-list">
          {filteredTickets.map((ticket) => (
            <button
              key={ticket.id}
              className={selectedTicket?.id === ticket.id ? 'admin-list-item ticket-list-item is-active' : 'admin-list-item ticket-list-item'}
              type="button"
              onClick={() => setSelectedTicketId(ticket.id)}
            >
              <span className={`ticket-status ticket-status--${ticket.status}`}>{ticketStatusLabel(ticket.status)}</span>
              <strong>{ticket.originalQuestion || ticket.message}</strong>
              <span>{ticket.name} · {ticket.contact}</span>
            </button>
          ))}
          {filteredTickets.length === 0 ? <EmptyState text="조건에 맞는 상담 티켓이 없습니다." /> : null}
        </div>

        {selectedTicket ? (
          <div className="admin-editor-card ticket-detail">
            <div className="ticket-detail__top">
              <div>
                <span>{selectedTicket.id}</span>
                <strong>{selectedTicket.originalQuestion || selectedTicket.message}</strong>
              </div>
              <span className={`ticket-status ticket-status--${selectedTicket.status}`}>{ticketStatusLabel(selectedTicket.status)}</span>
            </div>

            <div className="ticket-meta-grid">
              <div>
                <span>고객</span>
                <strong>{selectedTicket.name}</strong>
              </div>
              <div>
                <span>연락처</span>
                <strong>{selectedTicket.contact}</strong>
              </div>
              <div>
                <span>유입</span>
                <strong>{selectedTicket.source}</strong>
              </div>
              <div>
                <span>생성</span>
                <strong>{new Date(selectedTicket.createdAt).toLocaleString('ko-KR')}</strong>
              </div>
            </div>

            <TextAreaField label="문의 내용" value={selectedTicket.message} rows={4} readOnly onChange={() => undefined} />

            <div className="admin-form-grid">
              <label className="admin-field">
                <span>상태</span>
                <select value={selectedTicket.status} onChange={(event) => patchTicket(selectedTicket, { status: event.target.value as TicketStatus })}>
                  <option value="new">신규</option>
                  <option value="inProgress">확인 중</option>
                  <option value="resolved">답변 완료</option>
                  <option value="onHold">보류</option>
                </select>
              </label>
              <label className="admin-field">
                <span>우선순위</span>
                <select value={selectedTicket.priority} onChange={(event) => patchTicket(selectedTicket, { priority: event.target.value as TicketPriority })}>
                  <option value="low">낮음</option>
                  <option value="normal">보통</option>
                  <option value="high">높음</option>
                </select>
              </label>
            </div>

            <TextAreaField label="관리자 메모" value={selectedTicket.adminMemo} rows={4} onChange={(value) => patchTicket(selectedTicket, { adminMemo: value })} />

            {selectedTicket.matchedKnowledgeIds.length ? (
              <div className="ticket-related">
                <strong>매칭 FAQ</strong>
                {selectedTicket.matchedKnowledgeIds.map((knowledgeId) => (
                  <span key={knowledgeId}>{config.knowledge.find((item) => item.id === knowledgeId)?.question ?? knowledgeId}</span>
                ))}
              </div>
            ) : null}

            <button className="admin-add-button" type="button" onClick={() => createFaqDraft(selectedTicket)}>
              <Plus size={15} aria-hidden="true" />
              FAQ 초안 생성
            </button>
          </div>
        ) : (
          <EmptyState text="상담 티켓이 없습니다. 사용자 챗봇에서 상담 요청이 접수되면 여기에 표시됩니다." />
        )}
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
  ticketVersion: number,
  onTicketVersionChange: () => void,
  onUpdate: (updater: (config: BotConfig) => BotConfig) => void,
  onReplaceBotConfigs: (configs: BotConfigMap) => void,
) {
  if (activeView === 'bot') return <BotSettingsForm config={config} onUpdate={onUpdate} />;
  if (activeView === 'operation') return <OperationSettingsForm config={config} onUpdate={onUpdate} />;
  if (activeView === 'notices') return <NoticeEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'knowledge') return <KnowledgeEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'quickReplies') return <QuickReplyEditor config={config} onUpdate={onUpdate} />;
  if (activeView === 'quality') return <SearchQualityPanel config={config} unknownQuestions={unknownQuestions} onUpdate={onUpdate} />;
  if (activeView === 'tickets') return <TicketInboxPanel config={config} ticketVersion={ticketVersion} onTicketVersionChange={onTicketVersionChange} onUpdate={onUpdate} />;
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
}: AdminWorkspaceProps) {
  const [activeView, setActiveView] = useState<AdminPanelView>('bot');
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [ticketVersion, setTicketVersion] = useState(0);
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

      <div className="admin-content">
        {renderActivePanel(
          activeView,
          selectedConfig,
          unknownQuestions,
          botConfigs,
          selectedBotId,
          ticketVersion,
          () => setTicketVersion((current) => current + 1),
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
            onTicketCreated={() => setTicketVersion((current) => current + 1)}
          />
        </div>
      </aside>
    </main>
  );
}
