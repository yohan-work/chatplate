import type { RefObject } from 'react';
import { MessageCircle, X } from 'lucide-react';

interface ChatbotLauncherProps {
  buttonRef?: RefObject<HTMLButtonElement | null>;
  controlsId?: string;
  isOpen: boolean;
  unreadCount: number;
  onToggle: () => void;
}

export function ChatbotLauncher({ buttonRef, controlsId, isOpen, unreadCount, onToggle }: ChatbotLauncherProps) {
  return (
    <button
      ref={buttonRef}
      className={`chatplate-launcher${isOpen ? ' is-open' : ''}`}
      type="button"
      aria-controls={controlsId}
      aria-expanded={controlsId ? isOpen : undefined}
      aria-label={isOpen ? '챗봇 닫기' : '챗봇 열기'}
      onClick={onToggle}
    >
      {isOpen ? <X size={26} aria-hidden="true" /> : <MessageCircle size={28} aria-hidden="true" />}
      {!isOpen && unreadCount > 0 ? <span className="launcher-badge">{unreadCount}</span> : null}
    </button>
  );
}
