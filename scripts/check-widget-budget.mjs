import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const outputDir = new URL('../dist/', import.meta.url);
const files = readdirSync(outputDir).filter((name) =>
  name === 'widget.js' || name.startsWith('widget-widget-entry-') || name === 'widget-entry.css',
);
const budgets = {
  'widget.js': 20,
  app: 150,
  css: 20,
};
let failed = false;

for (const file of files) {
  const gzipKilobytes = gzipSync(readFileSync(join(outputDir.pathname, file))).byteLength / 1024;
  const budget = file === 'widget.js' ? budgets['widget.js'] : file.endsWith('.css') ? budgets.css : budgets.app;
  console.log(`${file}: ${gzipKilobytes.toFixed(2)}KB gzip / ${budget}KB budget`);
  if (gzipKilobytes > budget) failed = true;
}

if (!files.includes('widget.js') || !files.some((file) => file.startsWith('widget-widget-entry-'))) {
  throw new Error('Widget build artifacts are missing.');
}
if (failed) throw new Error('Widget bundle budget exceeded.');
