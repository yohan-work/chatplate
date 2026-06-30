import { useState } from 'react';
import { ChatbotLauncher } from '../components/widget/ChatbotLauncher';
import { ChatbotWidget } from '../components/widget/ChatbotWidget';
import { botConfigs, defaultBotId } from '../data/bots';

export function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [botId, setBotId] = useState(defaultBotId);
  const botConfig = botConfigs[botId];
  const unreadCount = botConfig.notices.filter((notice) => notice.unread).length;

  return (
    <main className="demo-page">
      <section className="demo-stage" aria-label="챗봇 위젯 데모">
        <div>
          <p className="demo-kicker">Embeddable support widget</p>
          <h1>Chatplate</h1>
          <p>
            JSON knowledge 데이터를 교체해 여러 도메인의 고객 상담 위젯으로 사용할 수 있는 MVP입니다.
          </p>
        </div>
      </section>

      <ChatbotLauncher isOpen={isOpen} unreadCount={unreadCount} onToggle={() => setIsOpen((value) => !value)} />
      <ChatbotWidget
        botConfig={botConfig}
        botId={botId}
        isOpen={isOpen}
        showDevBotSelector
        onClose={() => setIsOpen(false)}
        onBotChange={setBotId}
      />
    </main>
  );
}
