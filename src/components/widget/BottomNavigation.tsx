import { Home, MessageSquareText, Settings } from 'lucide-react';
import type { WidgetView } from '../../types/chatbot';

interface BottomNavigationProps {
  activeView: WidgetView;
  onChange: (view: WidgetView) => void;
}

const navItems: Array<{ view: WidgetView; label: string; icon: typeof Home }> = [
  { view: 'home', label: '홈', icon: Home },
  { view: 'conversations', label: '대화', icon: MessageSquareText },
  { view: 'settings', label: '설정', icon: Settings },
];

export function BottomNavigation({ activeView, onChange }: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="위젯 메뉴">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.view || (activeView === 'chat' && item.view === 'conversations');
        return (
          <button
            key={item.view}
            className={isActive ? 'bottom-nav__item is-active' : 'bottom-nav__item'}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(item.view)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
