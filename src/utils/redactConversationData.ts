export interface RedactionResult {
  text: string;
  redacted: boolean;
  sensitive: boolean;
  categories: Array<'email' | 'phone' | 'resident-id' | 'payment-number' | 'address'>;
}

const RULES: Array<{
  category: RedactionResult['categories'][number];
  pattern: RegExp;
  replacement: string;
  sensitive?: boolean;
}> = [
  { category: 'resident-id', pattern: /\b\d{6}\s*[- ]?\s*[1-4]\d{6}\b/gu, replacement: '[주민번호 삭제]', sensitive: true },
  { category: 'email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, replacement: '[이메일 삭제]' },
  { category: 'phone', pattern: /(?<!\d)(?:01[016789]|0[2-6][1-5]?)[- .]?\d{3,4}[- .]?\d{4}(?!\d)/gu, replacement: '[전화번호 삭제]' },
  { category: 'payment-number', pattern: /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/gu, replacement: '[금융번호 삭제]', sensitive: true },
  { category: 'address', pattern: /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n,]{0,35}(?:로|길|동)\s*\d{1,4}(?:-\d{1,4})?/gu, replacement: '[주소 삭제]' },
];

export function redactConversationText(value: string): RedactionResult {
  let text = value;
  const categories: RedactionResult['categories'] = [];
  let sensitive = false;
  RULES.forEach((rule) => {
    if (!rule.pattern.test(text)) {
      rule.pattern.lastIndex = 0;
      return;
    }
    rule.pattern.lastIndex = 0;
    text = text.replace(rule.pattern, rule.replacement);
    categories.push(rule.category);
    sensitive ||= Boolean(rule.sensitive);
  });
  return { text, redacted: categories.length > 0, sensitive, categories };
}
