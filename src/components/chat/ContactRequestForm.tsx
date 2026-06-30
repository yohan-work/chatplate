import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BotConfig, Ticket, TicketSource } from '../../types/chatbot';
import { appendTicket, validateTicketInput } from '../../utils/ticketStorage';

interface ContactRequestFormProps {
  botConfig: BotConfig;
  source: TicketSource;
  originalQuestion?: string;
  matchedKnowledgeIds?: string[];
  conversationEventId?: string;
  onCancel: () => void;
  onCreated: (ticket: Ticket) => void;
}

export function ContactRequestForm({
  botConfig,
  source,
  originalQuestion,
  matchedKnowledgeIds = [],
  conversationEventId,
  onCancel,
  onCreated,
}: ContactRequestFormProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState(originalQuestion ?? '');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const input = {
      botId: botConfig.bot.id,
      source,
      name,
      contact,
      message,
      originalQuestion,
      matchedKnowledgeIds,
      conversationEventId,
    };
    const validation = validateTicketInput(input);
    const nextErrors = privacyAgreed ? validation.errors : [...validation.errors, '개인정보 수집에 동의해 주세요.'];

    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    const ticket = appendTicket(input);
    onCreated(ticket);
  };

  return (
    <form className="contact-request-form" onSubmit={handleSubmit}>
      <div className="contact-request-form__head">
        <strong>상담 요청 남기기</strong>
        <span>{botConfig.operation.csHours}</span>
      </div>

      {errors.length ? (
        <ul className="contact-request-errors" aria-live="polite">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <label>
        <span>이름</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="홍길동" />
      </label>
      <label>
        <span>연락처</span>
        <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="이메일 또는 전화번호" />
      </label>
      <label>
        <span>문의 내용</span>
        <textarea value={message} rows={4} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <label className="contact-request-check">
        <input type="checkbox" checked={privacyAgreed} onChange={(event) => setPrivacyAgreed(event.target.checked)} />
        <span>답변을 위해 입력 정보를 저장하는 데 동의합니다.</span>
      </label>

      <div className="contact-request-actions">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <button type="submit">요청 접수</button>
      </div>
    </form>
  );
}
