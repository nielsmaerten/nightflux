#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, format, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Nightscout from './clients/nightscout';
import ProfileClient from './resources/profiles/profiles';
import { collectExport } from './collect';

type CliOptions = {
  url?: string;
  start?: string;
  end?: string;
  days?: number;
  out?: string;
  pretty?: boolean;
  help?: boolean;
  version?: boolean;
  positional?: string[];
};

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

function printHelp() {
  const version = readPackageVersion();
  const help = `nightflux-core ${version}\n\n` +
    `Usage: npx nightflux-core [url] [options]\\n\n` +
    `Options:\n` +
    `  -u, --url <url>        Nightscout base URL with ?token=...\n` +
    `  -s, --start <date>     Start date (YYYY-MM-DD)\n` +
    `  -e, --end <date>       End date (YYYY-MM-DD)\n` +
    `  -d, --days <n>         Number of days (overrides one side)\n` +
    `  -o, --out <file>       Output file path (default ns-report-START-END.json)\n` +
    `      --pretty           Pretty-print JSON (2 spaces)\n` +
    `  -h, --help             Show basic help\n` +
    `  -V, --version          Show version\n` +
    `\nExamples:\n` +
    `  npx nightflux-core https://ns.example?token=... -s 2025-09-01 -e 2025-09-07\n` +
    `  npx nightflux-core -u https://ns.example?token=... -d 30\n`;
  console.error(help);
}

function parseArgs(argv: string[]): CliOptions {
  const out: CliOptions = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--') break;
    if (arg === '-h' || arg === '--help') {
      out.help = true;
      continue;
    }
    if (arg === '-V' || arg === '--version') {
      out.version = true;
      continue;
    }
    if (arg === '-u' || arg === '--url') {
      out.url = next();
      continue;
    }
    if (arg === '-s' || arg === '--start') {
      out.start = next();
      continue;
    }
    if (arg === '-e' || arg === '--end') {
      out.end = next();
      continue;
    }
    if (arg === '-d' || arg === '--days') {
      const v = next();
      if (v === undefined) throw new Error('Missing value for --days');
      const n = Number(v);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) throw new Error('Invalid --days (must be positive integer).');
      out.days = n;
      continue;
    }
    if (arg === '-o' || arg === '--out') {
      out.out = next();
      continue;
    }
    if (arg === '--pretty') {
      out.pretty = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    out.positional!.push(arg);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.version) {
    console.log(readPackageVersion());
    process.exit(0);
  }

  // URL selection: positional > --url > env
  const positionalUrl = args.positional && args.positional[0];
  const url = positionalUrl || args.url || process.env.NIGHTSCOUT_URL;
  if (!url) {
    console.error('Error: Nightscout URL is required. Provide via positional [url], --url, or NIGHTSCOUT_URL env.');
    process.exit(1);
  }

  // Resolve timezone from latest profile (for correct default dates)
  const ns = new Nightscout(url);
  const profileClient = new ProfileClient(ns);
  let tz = 'UTC';
  try {
    const latestProfile = await profileClient.fetchLatestProfile();
    tz = latestProfile.tz || 'UTC';
  } catch (err: any) {
    console.error(`Error: Failed to resolve profile timezone: ${err?.message || err}`);
    process.exit(1);
  }

  // Date precedence and resolution
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const parseDate = (s: string) => {
    if (!dateRe.test(s)) throw new Error(`Invalid date format: ${s}. Expected YYYY-MM-DD.`);
    const p = parse(s, 'yyyy-MM-dd', new Date(0));
    if (format(p, 'yyyy-MM-dd') !== s) throw new Error(`Invalid date: ${s}.`);
    return p;
  };

  const todayTz = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  const ydayStr = format(addDays(parse(todayTz, 'yyyy-MM-dd', new Date(0)), -1), 'yyyy-MM-dd');

  let start = args.start;
  let end = args.end;
  const days = args.days;

  try {
    if (start && end) {
      // as-is
    } else if (start && days) {
      const sp = parseDate(start);
      end = format(addDays(sp, days - 1), 'yyyy-MM-dd');
    } else if (end && days) {
      const ep = parseDate(end);
      start = format(addDays(ep, -(days - 1)), 'yyyy-MM-dd');
    } else if (start && !end) {
      end = ydayStr;
    } else if (end && !start) {
      const ep = parseDate(end);
      start = format(addDays(ep, -29), 'yyyy-MM-dd');
    } else {
      // no dates provided
      end = ydayStr;
      start = format(addDays(parseDate(end), -29), 'yyyy-MM-dd');
    }

    // Validate both
    parseDate(start!);
    parseDate(end!);

    // Ensure ordering
    const sp = parseDate(start!);
    const ep = parseDate(end!);
    if (sp.getTime() > ep.getTime()) throw new Error('start must be <= end.');
  } catch (err: any) {
    console.error(`Error: ${err?.message || err}`);
    process.exit(1);
  }

  // Output file path
  const defaultOut = `ns-report-${start}-${end}.json`;
  const outPath = args.out ? path.resolve(args.out) : path.resolve(process.cwd(), defaultOut);

  try {
    const data = await collectExport(url, start!, end!);
    const json = args.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json + '\n', 'utf8');
    console.error(`Wrote ${outPath}`);
  } catch (err: any) {
    console.error(`Error: ${err?.message || err}`);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/cli.mjs')) {
  // Support being launched via cli.mjs as well
  main();
}
