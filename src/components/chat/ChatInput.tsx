import { FormEvent, useState } from 'react';
import { Paperclip, Send, Smile } from 'lucide-react';

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
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
      <button className="input-icon" type="button" aria-label="이모지 선택">
        <Smile size={18} aria-hidden="true" />
      </button>
      <button className="send-button" type="submit" aria-label="메시지 전송">
        <Send size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
