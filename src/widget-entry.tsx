import { StrictMode, useCallback, useEffect, useId, useRef, useState } from 'react';
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

export interface MountedWidget {
  root: Root;
  container: HTMLElement;
  destroy: () => void;
}

declare global {
  interface Window {
    Chatplate?: {
      init: (options?: ChatplateInitOptions) => MountedWidget;
    };
    ChatplateReady?: Promise<unknown>;
  }
}

interface ResolvedTarget {
  container: HTMLElement;
  ownsContainer: boolean;
}

const mountedWidgets = new WeakMap<HTMLElement, MountedWidget>();

function resolveTarget(target?: string | HTMLElement): ResolvedTarget {
  if (target instanceof HTMLElement) return { container: target, ownsContainer: false };
  if (typeof target === 'string') {
    const element = document.querySelector<HTMLElement>(target);
    if (element) return { container: element, ownsContainer: false };
  }

  const container = document.createElement('div');
  container.dataset.chatplateRoot = 'true';
  document.body.appendChild(container);
  return { container, ownsContainer: true };
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
  const widgetId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const unreadCount = botConfig.notices.filter((notice) => notice.unread).length + supportUnreadCount;

  useEffect(() => {
    let active = true;
    void loadPublishedBotConfig(botId)
      .then((config) => {
        if (!active) return;
        if (config) setBotConfig(config);
        onEvent?.({ type: 'ready', botId });
      })
      .catch(() => {
        if (active) onEvent?.({ type: 'ready', botId });
      });
    return () => {
      active = false;
    };
  }, [botId, onEvent]);

  const transitionOpen = useCallback((next: boolean) => {
    if (next === isOpen) return;
    setIsOpen(next);
    onEvent?.({ type: next ? 'open' : 'close', botId });
  }, [botId, isOpen, onEvent]);

  return (
    <>
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
    </>
  );
}

export function init(options?: ChatplateInitOptions): MountedWidget {
  const { container, ownsContainer } = resolveTarget(options?.target);
  mountedWidgets.get(container)?.destroy();

  const root = createRoot(container);
  const botConfig = resolveConfig(options);
  const botId = options?.botId ?? botConfig.bot.id;
  let destroyed = false;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    root.unmount();
    if (mountedWidgets.get(container) === mountedWidget) mountedWidgets.delete(container);
    if (ownsContainer) container.remove();
  };

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

  const mountedWidget: MountedWidget = { root, container, destroy };
  mountedWidgets.set(container, mountedWidget);
  return mountedWidget;
}

window.Chatplate = { init };
