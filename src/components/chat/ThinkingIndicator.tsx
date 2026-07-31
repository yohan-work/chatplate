import { Search } from 'lucide-react';

export function ThinkingIndicator() {
  return (
    <div className="thinking-indicator" role="status" aria-live="polite" aria-label="답변을 찾는 중">
      <Search size={17} strokeWidth={2} aria-hidden="true" />
      <span>답변을 찾는 중</span>
      <span className="thinking-indicator__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
