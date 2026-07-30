import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BotConfig, ConversationContact } from '../../types/chatbot';

interface ContactRequestFormProps {
  botConfig: BotConfig;
  originalQuestion?: string;
  onCancel: () => void;
  onSubmit: (contact: ConversationContact, message: string) => Promise<void>;
}

export function ContactRequestForm({
  botConfig,
  originalQuestion,
  onCancel,
  onSubmit,
}: ContactRequestFormProps) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms'>('sms');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState(originalQuestion ?? '');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = [
      ...(!name.trim() ? ['이름을 입력해 주세요.'] : []),
      ...(!contact.trim() ? ['연락처 또는 이메일을 입력해 주세요.'] : []),
      ...(!message.trim() ? ['문의 내용을 입력해 주세요.'] : []),
      ...(!privacyAgreed ? ['개인정보 수집에 동의해 주세요.'] : []),
    ];

    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          name: name.trim(),
          contact: contact.trim(),
          channel,
          privacyAgreedAt: new Date().toISOString(),
          consentVersion: '2026-07',
        },
        message.trim(),
      );
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '상담 요청을 접수하지 못했습니다.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="contact-request-form" onSubmit={handleSubmit}>
      <div className="contact-request-form__head">
        <strong>상담원 연결 요청</strong>
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
        <span>답변 받을 방법</span>
        <select value={channel} onChange={(event) => setChannel(event.target.value as 'email' | 'sms')}>
          <option value="sms">전화번호</option>
          <option value="email">이메일</option>
        </select>
      </label>
      <label>
        <span>{channel === 'email' ? '이메일' : '전화번호'}</span>
        <input
          value={contact}
          inputMode={channel === 'email' ? 'email' : 'tel'}
          onChange={(event) => setContact(event.target.value)}
          placeholder={channel === 'email' ? 'name@example.com' : '010-0000-0000'}
        />
      </label>
      <label>
        <span>문의 내용</span>
        <textarea value={message} rows={4} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <label className="contact-request-check">
        <input type="checkbox" checked={privacyAgreed} onChange={(event) => setPrivacyAgreed(event.target.checked)} />
        <span>답변을 위해 입력 정보를 최대 180일간 저장하는 데 동의합니다.</span>
      </label>

      <div className="contact-request-actions">
        <button type="button" onClick={onCancel} disabled={isSubmitting}>
          취소
        </button>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '연결 중…' : '상담 연결'}
        </button>
      </div>
    </form>
  );
}
