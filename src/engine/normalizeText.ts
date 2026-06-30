const SYMBOLS = /[^\p{L}\p{N}\s]/gu;
const SPACES = /\s+/g;

export function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('ko-KR')
    .replace(SYMBOLS, ' ')
    .replace(SPACES, ' ')
    .trim();
}
