import path from 'path';
import fs from 'fs';
import { NightfluxReport } from 'src/domain/schema';
import logger from './logger.js';
import { stringify as yamlStringify } from 'yaml';
import { includeCustomInstructions } from './custom-instructions.js';

type WriteOutputOptions = {
  outputFile: string;
  format: 'json' | 'yaml';
  pretty?: boolean;
  customInstructions?: boolean;
};

export function writeOutput(report: NightfluxReport, options: WriteOutputOptions): void {
  const { outputFile, format, pretty, customInstructions } = options;

  const payload = includeCustomInstructions(report, customInstructions !== false);
  let content: string;
  if (format === 'yaml') {
    content = yamlStringify(payload);
  } else {
    content = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  logger.info('Writing export file');
  fs.writeFileSync(outputFile, `${content}\n`, 'utf8');
  logger.info(`Wrote ${outputFile}`);
}
