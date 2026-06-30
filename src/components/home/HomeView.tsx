import { Bell, ChevronRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { BotConfig, ContactChannel, KnowledgeItem, Notice } from '../../types/chatbot';
import { ActionButton } from '../common/ActionButton';
import { findKnowledgeById } from '../../engine/searchKnowledge';

interface HomeViewProps {
  botConfig: BotConfig;
  unreadCount: number;
  onStartChat: () => void;
  onOpenNotice: (notice: Notice) => void;
  onQuestionSelect: (item: KnowledgeItem) => void;
}

function ChannelIcon({ channel }: { channel: ContactChannel }) {
  if (channel.icon === 'phone') return <Phone size={18} aria-hidden="true" />;
  if (channel.icon === 'email') return <Mail size={18} aria-hidden="true" />;
  if (channel.icon === 'map') return <MapPin size={18} aria-hidden="true" />;
  return <MessageCircle size={18} aria-hidden="true" />;
}

export function HomeView({ botConfig, unreadCount, onStartChat, onOpenNotice, onQuestionSelect }: HomeViewProps) {
  const primaryNotice = botConfig.notices[0];
  const unreadNotice = botConfig.notices.find((notice) => notice.unread) ?? primaryNotice;

  return (
    <div className="view-stack home-view">
      <section className="home-hero">
        <p>{botConfig.bot.title}</p>
        <h2>{botConfig.theme.homeTitle}</h2>
        <button className="primary-button" type="button" onClick={onStartChat}>
          <MessageCircle size={18} aria-hidden="true" />
          <span>문의하기</span>
        </button>
      </section>

      {primaryNotice ? (
        <article className="notice-card">
          <div>
            <span className="eyebrow">최근 공지</span>
            <h3>{primaryNotice.title}</h3>
            <p>{primaryNotice.summary}</p>
          </div>
          <div className="card-row">
            <span>{primaryNotice.createdAt}</span>
            <button className="text-button" type="button" onClick={() => onOpenNotice(primaryNotice)}>
              자세히 보기 <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        </article>
      ) : null}

      {unreadNotice ? (
        <button className="unread-card" type="button" onClick={() => onOpenNotice(unreadNotice)}>
          <span className="unread-card__icon">
            <Bell size={19} aria-hidden="true" />
          </span>
          <span>
            <strong>안 읽은 알림 {unreadCount}개</strong>
            <small>{unreadNotice.summary}</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : null}

      <section className="panel-section">
        <div className="section-title">
          <h3>다른 방법으로 문의</h3>
          <span>평균 응답 1영업일</span>
        </div>
        <div className="contact-grid">
          {botConfig.contactChannels.map((channel) => (
            <button
              className="contact-card"
              key={channel.id}
              type="button"
              onClick={() => {
                const href =
                  channel.type === 'tel'
                    ? `tel:${channel.value}`
                    : channel.type === 'mailto'
                      ? `mailto:${channel.value}`
                      : channel.value;
                window.open(href, '_blank', 'noopener,noreferrer');
              }}
            >
              <ChannelIcon channel={channel} />
              <span>{channel.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title">
          <h3>추천 질문</h3>
        </div>
        <div className="quick-list">
          {botConfig.quickReplies.slice(0, 3).map((reply) => (
            <ActionButton
              key={reply.knowledgeId}
              button={{ label: reply.label, type: 'action', value: `ask:${reply.knowledgeId}` }}
              onAction={(value) => {
                const item = findKnowledgeById(botConfig, value.replace('ask:', ''));
                if (item) {
                  onQuestionSelect(item);
                }
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
