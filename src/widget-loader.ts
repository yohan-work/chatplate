const script = document.currentScript as HTMLScriptElement | null;
const botId = script?.dataset.botId ?? 'coach-myway';
const autoInit = script?.dataset.autoInit !== 'false';

let widgetModule: Promise<typeof import('./widget-entry')> | undefined;
function importWidget() {
  return import('./widget-entry');
}

function loadWidget() {
  widgetModule ??= importWidget();
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
  button.textContent = '상담';
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
  button.addEventListener('click', () => {
    button.disabled = true;
    void mount(true).then(() => button.remove()).catch(() => {
      button.disabled = false;
      button.textContent = '다시 시도';
    });
  }, { once: true });
  document.body.appendChild(button);
} else {
  void loadWidget();
}
