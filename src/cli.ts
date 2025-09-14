#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { collectExport } from './collect.js';
import { stringify as yamlStringify } from 'yaml';
import logger from './utils/logger.js';
import { resolveRange, resolveTimezone } from './utils/range.js';
import { readSchemaMarkdown, toYamlCommentBlock } from './utils/yaml-header.js';

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

// Range utilities moved to src/utils/range.ts

async function run(
  urlArg: string | undefined,
  opts: {
    url?: string;
    start?: string;
    end?: string;
    days?: string | number;
    out?: string;
    pretty?: boolean;
    yaml?: boolean;
  },
) {
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

  const defaultOut = opts.yaml
    ? `ns-report-${start}-${end}.yaml`
    : `ns-report-${start}-${end}.json`;
  const outPath = opts.out ? path.resolve(opts.out) : path.resolve(process.cwd(), defaultOut);

  const data = await collectExport(url, start, end);
  let content = opts.yaml
    ? yamlStringify(data)
    : opts.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  if (opts.yaml) {
    const md = readSchemaMarkdown();
    if (md) {
      const header = toYamlCommentBlock(md);
      content = `${header}\n\n${content}`;
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  logger.info('Writing export file');
  fs.writeFileSync(outPath, content + '\n', 'utf8');
  logger.info(`Wrote ${outPath}`);
}

const program = new Command();
program
  .name('nightflux-core')
  .description('Export Nightscout data to a JSON report')
  .version(readPackageVersion(), '-V, --version', 'output the version number')
  .argument('[url]', 'Nightscout base URL with ?token=...')
  .option('-u, --url <url>', 'Nightscout base URL with ?token=...')
  .option('-s, --start <YYYY-MM-DD>', 'Start date')
  .option('-e, --end <YYYY-MM-DD>', 'End date')
  .option('-d, --days <n>', 'Number of days (overrides one side)')
  .option('-o, --out <file>', 'Output file (default ns-report-START-END.json)')
  .option('--pretty', 'Pretty-print JSON (2 spaces)')
  .option('--yaml', 'Export YAML instead of JSON')
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
