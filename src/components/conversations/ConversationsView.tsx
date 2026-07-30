import { MessageSquareText } from 'lucide-react';
import type { BotConfig, SupportConversation } from '../../types/chatbot';
import { Avatar } from '../common/Avatar';

interface ConversationsViewProps {
  botConfig: BotConfig;
  conversations: SupportConversation[];
  activeConversationId?: string;
  onOpenChat: (conversationId: string) => void;
}

function statusLabel(conversation: SupportConversation): string {
  if (conversation.status === 'waiting') return '상담 대기';
  if (conversation.status === 'human_active') return '상담 중';
  if (conversation.status === 'resolved') return '상담 완료';
  return '자동 안내';
}

export function ConversationsView({
  botConfig,
  conversations,
  activeConversationId,
  onOpenChat,
}: ConversationsViewProps) {
  return (
    <div className="view-stack">
      <section className="panel-section">
        <div className="section-title">
          <h3>대화</h3>
          <span>최근 문의 {conversations.length}개</span>
        </div>
        {conversations.map((conversation) => (
          <button
            className={conversation.id === activeConversationId ? 'conversation-card is-active' : 'conversation-card'}
            key={conversation.id}
            type="button"
            onClick={() => onOpenChat(conversation.id)}
          >
            <Avatar name={botConfig.bot.name} src={botConfig.bot.avatarUrl} />
            <span>
              <strong>{conversation.contact?.name ?? botConfig.bot.name} 상담</strong>
              <small>{statusLabel(conversation)} · {new Date(conversation.lastMessageAt).toLocaleDateString('ko-KR')}</small>
            </span>
            {conversation.unreadForVisitor > 0 ? (
              <b className="conversation-unread">{conversation.unreadForVisitor}</b>
            ) : <MessageSquareText size={20} aria-hidden="true" />}
          </button>
        ))}
        {conversations.length === 0 ? <p className="conversation-empty">저장된 대화가 없습니다.</p> : null}
      </section>
    </div>
  );
}
