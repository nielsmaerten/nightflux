#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, format, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Command } from 'commander';
import Nightscout from './clients/nightscout.js';
import ProfileClient from './resources/profiles/profiles.js';
import { collectExport } from './collect.js';

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const txt = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(txt) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseDateStrict(s: string): Date {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(s)) throw new Error(`Invalid date format: ${s}. Expected YYYY-MM-DD.`);
  const p = parse(s, 'yyyy-MM-dd', new Date(0));
  if (format(p, 'yyyy-MM-dd') !== s) throw new Error(`Invalid date: ${s}.`);
  return p;
}

async function resolveTimezone(url: string): Promise<string> {
  const ns = new Nightscout(url);
  const profileClient = new ProfileClient(ns);
  const latest = await profileClient.fetchLatestProfile();
  return latest.tz || 'UTC';
}

function resolveRange(tz: string, start?: string, end?: string, days?: number): { start: string; end: string } {
  const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  const yday = format(addDays(parse(today, 'yyyy-MM-dd', new Date(0)), -1), 'yyyy-MM-dd');
  let s = start;
  let e = end;
  if (s && e) {
    // keep
  } else if (s && days) {
    const sp = parseDateStrict(s);
    e = format(addDays(sp, days - 1), 'yyyy-MM-dd');
  } else if (e && days) {
    const ep = parseDateStrict(e);
    s = format(addDays(ep, -(days - 1)), 'yyyy-MM-dd');
  } else if (s && !e) {
    e = yday;
  } else if (e && !s) {
    const ep = parseDateStrict(e);
    s = format(addDays(ep, -29), 'yyyy-MM-dd');
  } else {
    e = yday;
    s = format(addDays(parseDateStrict(e), -29), 'yyyy-MM-dd');
  }
  const sp = parseDateStrict(s!);
  const ep = parseDateStrict(e!);
  if (sp.getTime() > ep.getTime()) throw new Error('start must be <= end.');
  return { start: s!, end: e! };
}

async function run(urlArg: string | undefined, opts: {
  url?: string;
  start?: string;
  end?: string;
  days?: string | number;
  out?: string;
  pretty?: boolean;
}) {
  const url = urlArg || opts.url || process.env.NIGHTSCOUT_URL;
  if (!url) throw new Error('Nightscout URL is required. Provide [url], --url, or NIGHTSCOUT_URL env.');

  const daysNum = opts.days === undefined ? undefined : Number(opts.days);
  if (daysNum !== undefined && (!Number.isFinite(daysNum) || !Number.isInteger(daysNum) || daysNum < 1)) {
    throw new Error('Invalid --days (must be positive integer).');
  }

  const tz = await resolveTimezone(url);
  const { start, end } = resolveRange(tz, opts.start, opts.end, daysNum);

  const defaultOut = `ns-report-${start}-${end}.json`;
  const outPath = opts.out ? path.resolve(opts.out) : path.resolve(process.cwd(), defaultOut);

  const data = await collectExport(url, start, end);
  const json = opts.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json + '\n', 'utf8');
  console.error(`Wrote ${outPath}`);
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
  .showHelpAfterError()
  .action(async (urlArg: string | undefined, opts: any) => {
    try {
      await run(urlArg, opts);
    } catch (err: any) {
      console.error(`Error: ${err?.message || err}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
