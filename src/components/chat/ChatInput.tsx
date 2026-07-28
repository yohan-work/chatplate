import { FormEvent, useState } from 'react';
import { Paperclip, Send, Smile } from 'lucide-react';

const MAX_MESSAGE_LENGTH = 300;

interface ChatInputProps {
  placeholder: string;
  onSubmit: (value: string) => void;
}

export function ChatInput({ placeholder, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <button className="input-icon" type="button" aria-label="파일 첨부">
        <Paperclip size={18} aria-hidden="true" />
      </button>
      <input
        value={value}
        maxLength={MAX_MESSAGE_LENGTH}
        title={`메시지는 최대 ${MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />
      <span className="chat-input__limit" aria-live="polite">
        {value.length}/{MAX_MESSAGE_LENGTH}
      </span>
      <button className="input-icon" type="button" aria-label="이모지 선택">
        <Smile size={18} aria-hidden="true" />
      </button>
      <button className="send-button" type="submit" aria-label="메시지 전송">
        <Send size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
