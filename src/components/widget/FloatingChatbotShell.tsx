import { useCallback, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { BotConfig } from '../../types/chatbot';
import { ChatbotLauncher } from './ChatbotLauncher';
import { ChatbotWidget } from './ChatbotWidget';

interface FloatingChatbotShellProps {
  botConfig: BotConfig;
  initiallyOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export function FloatingChatbotShell({
  botConfig,
  initiallyOpen = false,
  onOpenChange,
}: FloatingChatbotShellProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const widgetId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const unreadCount = botConfig.notices.filter((notice) => notice.unread).length + supportUnreadCount;

  const transitionOpen = useCallback((next: boolean) => {
    if (next === isOpen) return;
    setIsOpen(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);

  return (
    <div
      className="chatplate-floating-root"
      style={{ '--chatplate-primary': botConfig.theme.primaryColor } as CSSProperties}
    >
      <ChatbotLauncher
        buttonRef={launcherRef}
        controlsId={widgetId}
        isOpen={isOpen}
        unreadCount={unreadCount}
        onToggle={() => transitionOpen(!isOpen)}
      />
      <ChatbotWidget
        id={widgetId}
        botConfig={botConfig}
        isOpen={isOpen}
        onClose={() => transitionOpen(false)}
        onUnreadChange={setSupportUnreadCount}
        returnFocusRef={launcherRef}
      />
    </div>
  );
}

