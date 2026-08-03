import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { botConfigs } from '../data/bots';
import {
  coachMywayParityScenarios,
  validateCoachMywayParityCorpus,
} from '../data/coachMywayParityCorpus';
import { buildSearchIndex } from '../engine/buildSearchIndex';
import { normalizeText } from '../engine/normalizeText';
import {
  createBlindRatingTemplate,
  createBlindReview,
  itemsRequiringAdjudication,
  summarizeBlindRatings,
} from './conversationParityReview';
import { createConversationParityReport, renderConversationParityMarkdown } from './conversationParityReport';
import { createParityFixture, validateParityFixture } from './conversationParityFixture';
import type { BlindRating, ParityFixture, ParityTrace } from './conversationParityTypes';
import {
  createDeterministicResponder,
  evaluateParityResponderConcurrent,
} from './evaluateConversationParity';
import {
  createOpenAiEvaluationResponder,
  DEFAULT_PARITY_MODEL,
  PARITY_PROMPT_VERSION,
} from './openAiEvaluationResponder';
import { createOpenAiBlindJudge, judgeBlindReviewConcurrently } from './openAiBlindJudge';

const config = botConfigs['coach-myway'];
const command = process.argv[2] ?? 'diagnostic';

async function writeJson(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`wrote ${target}`);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), 'utf8')) as T;
}

function validateCorpus(): void {
  const errors = validateCoachMywayParityCorpus(new Set(config.knowledge.map((item) => item.id)));
  const indexed = new Set(buildSearchIndex(config).flatMap((entry) => entry.utterances));
  const leaks = coachMywayParityScenarios.flatMap((entry) => entry.turns)
    .filter((turn) => indexed.has(normalizeText(turn.query)))
    .map((turn) => turn.id);
  if (leaks.length) errors.push(`exact indexed query leakage: ${leaks.slice(0, 10).join(', ')}`);
  if (errors.length) throw new Error(`Parity corpus validation failed:\n- ${errors.join('\n- ')}`);
}

async function deterministicTraces(scenarios = coachMywayParityScenarios): Promise<ParityTrace[]> {
  const baseline = await evaluateParityResponderConcurrent(
    scenarios,
    createDeterministicResponder(config, 'baseline'),
    8,
  );
  const candidate = await evaluateParityResponderConcurrent(
    scenarios,
    createDeterministicResponder(config, 'candidate'),
    8,
  );
  return [...baseline, ...candidate];
}

async function run(): Promise<void> {
  validateCorpus();
  if (command === 'diagnostic' || command === 'holdout' || command === 'all') {
    const scenarios = command === 'all'
      ? coachMywayParityScenarios
      : coachMywayParityScenarios.filter((entry) => entry.split === command);
    const traces = await deterministicTraces(scenarios);
    console.log(renderConversationParityMarkdown(createConversationParityReport(traces)));
    return;
  }

  if (command === 'generate') {
    const output = process.argv[3] ?? '.parity/conversation-parity-fixture.json';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required only for the generate command. Deterministic and replay commands remain available.');
    const deterministic = await deterministicTraces();
    const llm = await evaluateParityResponderConcurrent(
      coachMywayParityScenarios,
      createOpenAiEvaluationResponder({ apiKey, config }),
      3,
    );
    const fixture = await createParityFixture(coachMywayParityScenarios, config, [...deterministic, ...llm], {
      model: DEFAULT_PARITY_MODEL,
      promptVersion: PARITY_PROMPT_VERSION,
    });
    await writeJson(output, fixture);
    console.log(renderConversationParityMarkdown(createConversationParityReport(fixture.traces)));
    return;
  }

  if (command === 'replay') {
    const fixturePath = process.argv[3];
    if (!fixturePath) throw new Error('Usage: replay <fixture.json>');
    const fixture = await readJson<ParityFixture>(fixturePath);
    const errors = await validateParityFixture(fixture, coachMywayParityScenarios, config);
    if (errors.length) throw new Error(`Fixture validation failed: ${errors.join(', ')}`);
    const blind = fixture.ratings && fixture.blindKey
      ? summarizeBlindRatings(fixture.ratings, fixture.blindKey)
      : undefined;
    console.log(renderConversationParityMarkdown(createConversationParityReport(fixture.traces, blind)));
    return;
  }

  if (command === 'blind-export') {
    const fixturePath = process.argv[3];
    const outputDirectory = process.argv[4] ?? '.parity/blind';
    if (!fixturePath) throw new Error('Usage: blind-export <fixture.json> [output-directory]');
    const fixture = await readJson<ParityFixture>(fixturePath);
    const review = createBlindReview(fixture.traces);
    await writeJson(`${outputDirectory}/review-items.json`, review.items);
    await writeJson(`${outputDirectory}/review-key.json`, review.key);
    await writeJson(`${outputDirectory}/reviewer-1.json`, createBlindRatingTemplate(review.items, 'reviewer-1'));
    await writeJson(`${outputDirectory}/reviewer-2.json`, createBlindRatingTemplate(review.items, 'reviewer-2'));
    return;
  }

  if (command === 'score') {
    const [fixturePath, keyPath, ...ratingPaths] = process.argv.slice(3);
    const [firstRatingsPath, secondRatingsPath] = ratingPaths;
    if (!fixturePath || !keyPath || !firstRatingsPath || !secondRatingsPath) {
      throw new Error('Usage: score <fixture.json> <key.json> <reviewer-1.json> <reviewer-2.json> [adjudicator.json]');
    }
    const fixture = await readJson<ParityFixture>(fixturePath);
    const key = await readJson<NonNullable<ParityFixture['blindKey']>>(keyPath);
    const ratings = (await Promise.all(ratingPaths.map((path) => readJson<BlindRating[]>(path)))).flat();
    const scored: ParityFixture = { ...fixture, blindKey: key, ratings };
    const summary = summarizeBlindRatings(ratings, key);
    console.log(renderConversationParityMarkdown(createConversationParityReport(scored.traces, summary)));
    return;
  }

  if (command === 'adjudication-export') {
    const [reviewPath, firstRatingsPath, secondRatingsPath, outputPath = '.parity/blind/adjudicator.json'] = process.argv.slice(3);
    if (!reviewPath || !firstRatingsPath || !secondRatingsPath) {
      throw new Error('Usage: adjudication-export <review-items.json> <reviewer-1.json> <reviewer-2.json> [output.json]');
    }
    const items = await readJson<ReturnType<typeof createBlindReview>['items']>(reviewPath);
    const ratings = [
      ...await readJson<BlindRating[]>(firstRatingsPath),
      ...await readJson<BlindRating[]>(secondRatingsPath),
    ];
    const disputed = itemsRequiringAdjudication(items, ratings);
    await writeJson(outputPath, createBlindRatingTemplate(disputed, 'adjudicator'));
    console.log(JSON.stringify({ disputedItems: disputed.length }, null, 2));
    return;
  }

  if (command === 'judge') {
    const reviewPath = process.argv[3];
    const outputPath = process.argv[4] ?? '.parity/blind/llm-judge.json';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!reviewPath) throw new Error('Usage: judge <review-items.json> [output.json]');
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for the judge command.');
    const items = await readJson<ReturnType<typeof createBlindReview>['items']>(reviewPath);
    const ratings = await judgeBlindReviewConcurrently(items, createOpenAiBlindJudge({ apiKey, config }), 3);
    await writeJson(outputPath, ratings);
    console.log(JSON.stringify({ completed: ratings.filter((rating) => rating.completed).length, total: ratings.length }, null, 2));
    return;
  }

  throw new Error(`Unknown parity command: ${command}`);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
