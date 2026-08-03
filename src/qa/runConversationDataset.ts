import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { botConfigs } from '../data/bots';
import {
  COACH_MYWAY_PHASE6_CHALLENGE_COUNT,
  COACH_MYWAY_PHASE6_DEVELOPMENT_COUNT,
  COACH_MYWAY_PHASE6_SEALED_COUNT,
  COACH_MYWAY_PHASE6_TOTAL_COUNT,
  coachMywayPhase6Scenarios,
} from '../data/coachMywayPhase6Corpus';
import type { ConversationEvent } from '../types/chatbot';
import {
  createConversationDatasetManifest,
  findConversationDatasetLeakage,
  summarizeConversationDataset,
  validateConversationDataset,
} from './conversationDataset';
import { conversationEventsFromCsv, importConversationEventsToInbox } from './conversationDatasetImport';
import type { ConversationDatasetSplit } from './conversationDatasetTypes';
import { evaluateConversationDataset, renderConversationDatasetReport } from './evaluateConversationDataset';

const config = botConfigs['coach-myway'];
const command = process.argv[2] ?? 'validate';
const VERSION = 'phase6-v1';

async function writeJson(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`wrote ${target}`);
}

function assertExpectedCounts(): string[] {
  const bySplit = summarizeConversationDataset(coachMywayPhase6Scenarios, config).bySplit;
  const expected: Record<string, number> = {
    development: COACH_MYWAY_PHASE6_DEVELOPMENT_COUNT,
    challenge: COACH_MYWAY_PHASE6_CHALLENGE_COUNT,
    sealed: COACH_MYWAY_PHASE6_SEALED_COUNT,
  };
  const errors = Object.entries(expected).flatMap(([split, count]) => bySplit[split] === count ? [] : [`${split}: expected ${count}, got ${bySplit[split] ?? 0}`]);
  if (coachMywayPhase6Scenarios.length !== COACH_MYWAY_PHASE6_TOTAL_COUNT) errors.push(`total: expected ${COACH_MYWAY_PHASE6_TOTAL_COUNT}, got ${coachMywayPhase6Scenarios.length}`);
  return errors;
}

async function run(): Promise<void> {
  if (command === 'validate') {
    const errors = [...assertExpectedCounts(), ...validateConversationDataset(coachMywayPhase6Scenarios, config)];
    const leakage = findConversationDatasetLeakage(coachMywayPhase6Scenarios, config);
    const blockingLeakage = leakage.filter((finding) => finding.kind !== 'indexed-near');
    console.log(JSON.stringify({ valid: errors.length === 0 && blockingLeakage.length === 0, errors, leakage }, null, 2));
    if (errors.length || blockingLeakage.length) process.exitCode = 1;
    return;
  }

  if (command === 'coverage') {
    console.log(JSON.stringify(summarizeConversationDataset(coachMywayPhase6Scenarios, config), null, 2));
    return;
  }

  if (command === 'leakage') {
    const findings = findConversationDatasetLeakage(coachMywayPhase6Scenarios, config);
    const byKind = findings.reduce<Record<string, number>>((counts, finding) => ({
      ...counts,
      [finding.kind]: (counts[finding.kind] ?? 0) + 1,
    }), {});
    console.log(JSON.stringify({ findings: findings.length, byKind, details: findings }, null, 2));
    if (findings.some((finding) => finding.kind !== 'indexed-near')) process.exitCode = 1;
    return;
  }

  if (command === 'freeze') {
    const output = process.argv[3] ?? '.qa/phase6/dataset.json';
    const manifest = await createConversationDatasetManifest(coachMywayPhase6Scenarios, config, VERSION);
    await writeJson(output, { manifest, scenarios: coachMywayPhase6Scenarios });
    return;
  }

  if (command === 'evaluate') {
    const split = (process.argv[3] ?? 'all') as ConversationDatasetSplit | 'all';
    if (!['development', 'challenge', 'sealed', 'all'].includes(split)) throw new Error('Usage: evaluate [development|challenge|sealed|all] [json-output]');
    const report = await evaluateConversationDataset(coachMywayPhase6Scenarios, config, split);
    console.log(renderConversationDatasetReport(report));
    if (process.argv[4]) await writeJson(process.argv[4], report);
    if (!report.accepted) process.exitCode = 1;
    return;
  }

  if (command === 'import-events') {
    const input = process.argv[3];
    const output = process.argv[4] ?? '.qa/phase6/production-inbox.json';
    if (!input) throw new Error('Usage: import-events <events.csv|events.json> [output.json]');
    const raw = await readFile(resolve(input), 'utf8');
    const events = input.toLowerCase().endsWith('.csv')
      ? conversationEventsFromCsv(raw)
      : JSON.parse(raw) as ConversationEvent[];
    const scenarios = importConversationEventsToInbox(events);
    await writeJson(output, { importedAt: new Date().toISOString(), sourceEvents: events.length, scenarios });
    console.log(JSON.stringify({ sourceEvents: events.length, scenarios: scenarios.length, rejectedSensitive: scenarios.filter((scenario) => scenario.status === 'rejected-sensitive').length }, null, 2));
    return;
  }

  throw new Error(`Unknown dataset command: ${command}`);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
