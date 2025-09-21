#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';
import { collectExport } from './collect.js';
import type { NightfluxReport } from './domain/schema.js';
import logger from './utils/logger.js';
import { resolveRange, resolveTimezone } from './utils/range.js';
import { writeOutput } from './utils/write-output.js';

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'package.json',
    );
    const txt = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(txt) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function resolveRememberDirectory(): string {
  const stateHome = process.env.XDG_STATE_HOME;
  if (stateHome && stateHome.trim()) {
    return path.join(stateHome, 'nightflux');
  }
  const configHome = process.env.XDG_CONFIG_HOME;
  if (configHome && configHome.trim()) {
    return path.join(configHome, 'nightflux');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'nightflux');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'nightflux');
  }
  return path.join(os.homedir(), '.config', 'nightflux');
}

function resolveRememberedUrlPath(): string {
  return path.join(resolveRememberDirectory(), 'nightscout-url');
}

function readRememberedNightscoutUrl(): string | undefined {
  try {
    const filePath = resolveRememberedUrlPath();
    const raw = fs.readFileSync(filePath, 'utf8');
    const trimmed = raw.trim();
    return trimmed ? trimmed : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return undefined;
    }
    return undefined;
  }
}

function rememberNightscoutUrl(url: string): void {
  try {
    const filePath = resolveRememberedUrlPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${url}\n`, 'utf8');
    logger.info('Remembered Nightscout URL for future runs.');
  } catch (error) {
    const message = (error as Error)?.message || String(error);
    logger.info(`Warning: Unable to remember Nightscout URL (${message}).`);
  }
}

function forgetRememberedNightscoutUrl(): void {
  try {
    const filePath = resolveRememberedUrlPath();
    fs.rmSync(filePath, { force: true });
    logger.info('Cleared remembered Nightscout URL.');
  } catch (error) {
    const message = (error as Error)?.message || String(error);
    logger.info(`Warning: Unable to clear remembered Nightscout URL (${message}).`);
  }
}

function ensureValidNightscoutUrl(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) {
    throw new Error('Nightscout URL is required. Provide [url], --url, or NIGHTSCOUT_URL env.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid Nightscout URL. Provide a fully qualified http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Invalid Nightscout URL protocol. Use http:// or https://.');
  }
  return parsed.toString();
}

type RunOptions = {
  url?: string;
  start?: string;
  end?: string;
  days?: string | number;
  output?: string;
  pretty?: boolean;
  format?: 'json' | 'yaml';
  quiet?: boolean;
  customInstructions?: boolean;
  remember?: boolean;
};

async function run(urlArg: string | undefined, opts: RunOptions) {
  const positionalUrl = typeof urlArg === 'string' ? urlArg.trim() || undefined : undefined;
  const optionUrl = typeof opts.url === 'string' ? opts.url.trim() || undefined : undefined;
  const hasPositionalUrl = positionalUrl !== undefined;
  const hasFlagUrl = optionUrl !== undefined;
  if (opts.remember && !hasPositionalUrl && !hasFlagUrl) {
    forgetRememberedNightscoutUrl();
    return;
  }

  const rememberedUrl = readRememberedNightscoutUrl();
  const envUrl =
    typeof process.env.NIGHTSCOUT_URL === 'string'
      ? process.env.NIGHTSCOUT_URL.trim() || undefined
      : undefined;
  const candidateUrl = positionalUrl || optionUrl || envUrl || rememberedUrl;
  const resolvedUrl = ensureValidNightscoutUrl(candidateUrl || '');
  if (opts.remember) {
    rememberNightscoutUrl(resolvedUrl);
  }

  const daysNum = opts.days === undefined ? undefined : Number(opts.days);
  if (
    daysNum !== undefined &&
    (!Number.isFinite(daysNum) || !Number.isInteger(daysNum) || daysNum < 1)
  ) {
    throw new Error('Invalid --days (must be positive integer).');
  }

  const tz = await resolveTimezone(resolvedUrl);
  const { start, end } = resolveRange(tz, opts.start, opts.end, daysNum);

  const format = opts.format === 'json' ? 'json' : 'yaml';
  const outPath = resolveOutputPath({ format, start, end, requested: opts.output });

  const report = await collectExport(resolvedUrl, start, end);
  const includeCustomInstructions = opts.customInstructions !== false;
  writeReportFile(report, {
    outputFile: outPath,
    format,
    pretty: opts.pretty,
    customInstructions: includeCustomInstructions,
  });
}

type WriteReportParams = {
  outputFile: string;
  format: 'json' | 'yaml';
  pretty?: boolean;
  customInstructions?: boolean;
};

function resolveOutputPath(options: {
  format: 'json' | 'yaml';
  start: string;
  end: string;
  requested?: string;
}): string {
  if (options.requested) return path.resolve(options.requested);
  const basename = `ns-report-${options.start}-${options.end}.${options.format}`;
  return path.resolve(process.cwd(), basename);
}

function writeReportFile(report: NightfluxReport, params: WriteReportParams): void {
  writeOutput(report, params);
}

const program = new Command();
program
  .name('nightflux')
  .description('Export Nightscout data to a report file (YAML by default)')
  .version(readPackageVersion(), '-V, --version', 'output the version number')
  .argument('[url]', 'Nightscout base URL with ?token=...')
  .option('-u, --url <url>', 'Nightscout base URL with ?token=...')
  .option('-s, --start <YYYY-MM-DD>', 'Start date')
  .option('-e, --end <YYYY-MM-DD>', 'End date')
  .option('-d, --days <n>', 'Number of days (overrides one side)')
  .option('-o, --output <file>', 'Output file (default ns-report-START-END.yaml)')
  .addOption(
    new Option('-f, --format <type>', 'Output format').choices(['json', 'yaml']).default('yaml'),
  )
  .option('-p, --pretty', 'Pretty-print JSON (2 spaces)')
  .option('-x, --no-custom-instructions', 'Omit custom_instructions field in the export')
  .option('-r, --remember', 'Remember the Nightscout URL (or clear it when no URL is provided)')
  .option('-q, --quiet', 'Suppress logs')
  .showHelpAfterError()
  .action(async (urlArg: string | undefined, opts: any) => {
    try {
      // Configure logger verbosity before running
      logger.setQuiet(!!opts.quiet);
      await run(urlArg, opts);
    } catch (err: any) {
      console.error(`Error: ${err?.message || err}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
