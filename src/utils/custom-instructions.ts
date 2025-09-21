import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NightfluxReport } from '../domain/schema.js';

function resolveCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(here, '../public/custom-instructions.md'),
    path.resolve(here, '../public/system-message.md'),
    path.resolve(here, '../../src/public/custom-instructions.md'),
    path.resolve(here, '../../src/public/system-message.md'),
    path.resolve(process.cwd(), 'src/public/custom-instructions.md'),
    path.resolve(process.cwd(), 'src/public/system-message.md'),
    path.resolve(process.cwd(), 'custom-instructions.md'),
    path.resolve(process.cwd(), 'system-message.md'),
  ];
}

export function readCustomInstructions(): string | null {
  const candidates = resolveCandidates();
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const text = fs.readFileSync(filePath, 'utf8').trimEnd();
        return text.length > 0 ? text : null;
      }
    } catch {
      // ignore and try next candidate
    }
  }
  return null;
}

export function includeCustomInstructions(
  report: NightfluxReport,
  enabled: boolean,
): NightfluxReport {
  if (!enabled) return report;
  const message = readCustomInstructions();
  if (!message) return report;
  const { $schema, ...rest } = report;
  return { $schema, custom_instructions: message, ...rest };
}
