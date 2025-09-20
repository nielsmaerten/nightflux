import path from 'path';
import fs from 'fs';
import { NightfluxReport } from 'src/domain/schema';
import logger from './logger';
import { stringify as yamlStringify } from 'yaml';
import { includeSystemMessage } from './system-message';

type WriteOutputOptions = {
  outputFile: string;
  format: 'json' | 'yaml';
  pretty?: boolean;
  systemMessage?: boolean;
};

export function writeOutput(report: NightfluxReport, options: WriteOutputOptions): void {
  const { outputFile, format, pretty, systemMessage } = options;

  const payload = includeSystemMessage(report, systemMessage !== false);
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
