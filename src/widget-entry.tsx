import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChatbotLauncher } from './components/widget/ChatbotLauncher';
import { ChatbotWidget } from './components/widget/ChatbotWidget';
import type { BotConfig } from './types/chatbot';
import { validateBotConfig } from './utils/dataPortability';
import { loadPublishedBotConfig } from './services/loadPublishedBotConfig';
import { publicFallbackConfig } from './data/publicFallback';
import './styles/tokens.css';
import './styles/widget.css';

export interface ChatplateInitOptions {
  botId?: string;
  config?: BotConfig;
  target?: string | HTMLElement;
  visitor?: {
    externalId?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  context?: {
    pageUrl?: string;
    pageTitle?: string;
    referrer?: string;
  };
  onEvent?: (event: { type: 'ready' | 'open' | 'close'; botId: string }) => void;
  open?: boolean;
}

interface MountedWidget {
  root: Root;
  container: HTMLElement;
}

declare global {
  interface Window {
    Chatplate?: {
      init: (options?: ChatplateInitOptions) => MountedWidget;
    };
    ChatplateReady?: Promise<unknown>;
  }
}

function resolveTarget(target?: string | HTMLElement): HTMLElement {
  if (target instanceof HTMLElement) return target;
  if (typeof target === 'string') {
    const element = document.querySelector<HTMLElement>(target);
    if (element) return element;
  }

  const container = document.createElement('div');
  container.dataset.chatplateRoot = 'true';
  document.body.appendChild(container);
  return container;
}

function resolveConfig(options?: ChatplateInitOptions): BotConfig {
  if (options?.config && validateBotConfig(options.config).ok) return options.config;
  return {
    ...publicFallbackConfig,
    bot: {
      ...publicFallbackConfig.bot,
      id: options?.botId ?? document.currentScript?.getAttribute('data-bot-id') ?? publicFallbackConfig.bot.id,
    },
  };
}

function PublicWidget({
  botId,
  initialConfig,
  initiallyOpen = false,
  onEvent,
}: {
  botId: string;
  initialConfig: BotConfig;
  initiallyOpen?: boolean;
  onEvent?: ChatplateInitOptions['onEvent'];
}) {
  const [botConfig, setBotConfig] = useState(initialConfig);
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const unreadCount = botConfig.notices.filter((notice) => notice.unread).length + supportUnreadCount;

  useEffect(() => {
    let active = true;
    void loadPublishedBotConfig(botId)
      .then((config) => {
        if (active && config) setBotConfig(config);
        onEvent?.({ type: 'ready', botId });
      })
      .catch(() => onEvent?.({ type: 'ready', botId }));
    return () => {
      active = false;
    };
  }, [botId, onEvent]);

  return (
    <>
      <ChatbotLauncher
        isOpen={isOpen}
        unreadCount={unreadCount}
        onToggle={() => setIsOpen((current) => {
          const next = !current;
          onEvent?.({ type: next ? 'open' : 'close', botId });
          return next;
        })}
      />
      <ChatbotWidget
        botConfig={botConfig}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUnreadChange={setSupportUnreadCount}
      />
    </>
  );
}

export function init(options?: ChatplateInitOptions): MountedWidget {
  const container = resolveTarget(options?.target);
  const root = createRoot(container);
  const botConfig = resolveConfig(options);
  const botId = options?.botId ?? botConfig.bot.id;

  root.render(
    <StrictMode>
      <PublicWidget
        botId={botId}
        initialConfig={botConfig}
        initiallyOpen={options?.open}
        onEvent={options?.onEvent}
      />
    </StrictMode>,
  );

  return { root, container };
}

window.Chatplate = { init };
