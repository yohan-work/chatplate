import { attachRetryableLauncher, createRetryableLoader } from './services/retryableWidgetLoader';

const script = document.currentScript as HTMLScriptElement | null;
const botId = script?.dataset.botId ?? 'coach-myway';
const autoInit = script?.dataset.autoInit !== 'false';

function importWidget() {
  return import('./widget-entry');
}

const retryableImportWidget = createRetryableLoader(importWidget);

function loadWidget() {
  const widgetModule = retryableImportWidget();
  (window as Window & { ChatplateReady?: Promise<unknown> }).ChatplateReady = widgetModule;
  return widgetModule;
}

async function mount(open = false) {
  const { init } = await loadWidget();
  return init({ botId, open });
}

if (autoInit) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', '상담 채팅 열기');
  button.setAttribute('aria-live', 'polite');
  button.style.cssText = [
    'position:fixed',
    'right:24px',
    'bottom:24px',
    'z-index:2147483000',
    'width:56px',
    'height:56px',
    'border:0',
    'border-radius:18px',
    'color:#fff',
    'background:#6657d9',
    'box-shadow:0 12px 30px rgba(31,35,48,.22)',
    'font:700 13px system-ui,sans-serif',
    'cursor:pointer',
  ].join(';');
  attachRetryableLauncher({
    button,
    mount: () => mount(true),
    idleLabel: '상담',
    retryLabel: '다시 시도',
    retryAriaLabel: '상담 채팅 다시 시도',
  });
  document.body.appendChild(button);
} else {
  void loadWidget();
}
