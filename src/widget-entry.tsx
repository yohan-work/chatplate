import { StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChatbotLauncher } from './components/widget/ChatbotLauncher';
import { ChatbotWidget } from './components/widget/ChatbotWidget';
import { botConfigs, defaultBotId } from './data/bots';
import type { BotConfig } from './types/chatbot';
import { validateBotConfig } from './utils/dataPortability';
import './styles/tokens.css';
import './styles/widget.css';

interface ChatplateInitOptions {
  botId?: string;
  config?: BotConfig;
  target?: string | HTMLElement;
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
  const botId = options?.botId ?? document.currentScript?.getAttribute('data-bot-id') ?? defaultBotId;
  return botConfigs[botId] ?? botConfigs[defaultBotId];
}

function PublicWidget({ botConfig }: { botConfig: BotConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = botConfig.notices.filter((notice) => notice.unread).length;

  return (
    <>
      <ChatbotLauncher isOpen={isOpen} unreadCount={unreadCount} onToggle={() => setIsOpen((current) => !current)} />
      <ChatbotWidget
        botConfig={botConfig}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

function init(options?: ChatplateInitOptions): MountedWidget {
  const container = resolveTarget(options?.target);
  const root = createRoot(container);
  const botConfig = resolveConfig(options);

  root.render(
    <StrictMode>
      <PublicWidget botConfig={botConfig} />
    </StrictMode>,
  );

  return { root, container };
}

window.Chatplate = { init };

if (document.currentScript?.getAttribute('data-auto-init') !== 'false') {
  init();
}
