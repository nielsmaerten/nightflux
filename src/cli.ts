#!/usr/bin/env node
import fs from 'node:fs';
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
};

async function run(urlArg: string | undefined, opts: RunOptions) {
  const url = urlArg || opts.url || process.env.NIGHTSCOUT_URL;
  if (!url)
    throw new Error('Nightscout URL is required. Provide [url], --url, or NIGHTSCOUT_URL env.');

  const daysNum = opts.days === undefined ? undefined : Number(opts.days);
  if (
    daysNum !== undefined &&
    (!Number.isFinite(daysNum) || !Number.isInteger(daysNum) || daysNum < 1)
  ) {
    throw new Error('Invalid --days (must be positive integer).');
  }

  const tz = await resolveTimezone(url);
  const { start, end } = resolveRange(tz, opts.start, opts.end, daysNum);

  const format = opts.format === 'json' ? 'json' : 'yaml';
  const outPath = resolveOutputPath({ format, start, end, requested: opts.output });

  const report = await collectExport(url, start, end);
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
