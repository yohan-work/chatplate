import { MessageCircle } from 'lucide-react';
import { FloatingChatbotShell } from '../components/widget/FloatingChatbotShell';
import { botConfigs } from '../data/bots';

const botConfig = botConfigs['coach-myway'];

export function CustomerApp() {
  return (
    <main className="customer-page">
      <header className="customer-page__header">
        <a href="/" className="customer-page__brand">COACH MY:WAY</a>
        <a className="customer-page__contact" href="https://linktr.ee/coachmyway" target="_blank" rel="noreferrer">
          <MessageCircle size={16} aria-hidden="true" /> 카카오 상담
        </a>
      </header>
      <section className="customer-page__intro">
        <p>학부모·학생 상담 도우미</p>
        <h1>지금 필요한 학습 고민부터<br />차분히 정리해 보세요.</h1>
        <span>등록된 안내를 바탕으로 답변하며, 개인별 판단이 필요한 내용은 상담 채널로 연결합니다.</span>
      </section>
      <FloatingChatbotShell botConfig={botConfig} />
    </main>
  );
}
