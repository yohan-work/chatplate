import { MessageCircle, X } from 'lucide-react';

interface ChatbotLauncherProps {
  isOpen: boolean;
  unreadCount: number;
  onToggle: () => void;
}

export function ChatbotLauncher({ isOpen, unreadCount, onToggle }: ChatbotLauncherProps) {
  return (
    <button className="chatplate-launcher" type="button" aria-label={isOpen ? '챗봇 닫기' : '챗봇 열기'} onClick={onToggle}>
      {isOpen ? <X size={26} aria-hidden="true" /> : <MessageCircle size={28} aria-hidden="true" />}
      {!isOpen && unreadCount > 0 ? <span className="launcher-badge">{unreadCount}</span> : null}
    </button>
  );
}
