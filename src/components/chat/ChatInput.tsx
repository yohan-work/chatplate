import { FormEvent, KeyboardEvent, useState } from 'react';
import { ArrowUp, Plus } from 'lucide-react';

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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <button className="input-icon" type="button" aria-label="파일 첨부">
        <Plus size={22} aria-hidden="true" />
      </button>
      <textarea
        rows={1}
        value={value}
        maxLength={MAX_MESSAGE_LENGTH}
        title={`메시지는 최대 ${MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <button className="send-button" type="submit" aria-label="메시지 전송" disabled={!value.trim()}>
        <ArrowUp size={21} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </form>
  );
}
