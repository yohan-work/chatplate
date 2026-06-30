import { ArrowLeft } from 'lucide-react';
import type { Notice } from '../../types/chatbot';
import { ActionButton } from '../common/ActionButton';

interface NoticeDetailViewProps {
  notice: Notice;
  onBack: () => void;
  onAction: (value: string) => void;
}

export function NoticeDetailView({ notice, onBack, onAction }: NoticeDetailViewProps) {
  return (
    <article className="view-stack notice-detail">
      <button className="text-button text-button--left" type="button" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        홈으로
      </button>
      <span className="eyebrow">{notice.createdAt}</span>
      <h2>{notice.title}</h2>
      <p>{notice.content}</p>
      <div className="bubble-actions">
        {notice.buttons.map((button) => (
          <ActionButton key={`${button.label}-${button.value}`} button={button} onAction={onAction} />
        ))}
      </div>
    </article>
  );
}
