import { ExternalLink, Phone } from 'lucide-react';
import type { AnswerButton } from '../../types/chatbot';

interface ActionButtonProps {
  button: AnswerButton;
  onAction?: (value: string) => void;
}

export function ActionButton({ button, onAction }: ActionButtonProps) {
  const handleClick = () => {
    if (button.type === 'action') {
      onAction?.(button.value);
      return;
    }

    const href =
      button.type === 'tel' ? `tel:${button.value}` : button.type === 'mailto' ? `mailto:${button.value}` : button.value;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <button className="action-button" type="button" onClick={handleClick}>
      {button.type === 'tel' ? <Phone size={15} aria-hidden="true" /> : <ExternalLink size={15} aria-hidden="true" />}
      <span>{button.label}</span>
    </button>
  );
}
