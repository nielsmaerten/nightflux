import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locate and read the schema/system Markdown doc from the repo.
 * Tries a few likely locations so it works from src and dist.
 */
export function readSchemaMarkdown(): string | null {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      // When running from src
      path.resolve(here, '../public/schema.md'),
      // When running from dist
      path.resolve(here, '../../src/public/schema.md'),
      // Fallbacks from CWD
      path.resolve(process.cwd(), 'src/public/schema.md'),
      path.resolve(process.cwd(), 'schema.md'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const txt = fs.readFileSync(p, 'utf8');
          return txt.trim();
        }
      } catch {
        // try next
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Convert Markdown text into a YAML comment block.
 */
export function toYamlCommentBlock(markdown: string): string {
  const lines = String(markdown).split(/\r?\n/);
  return lines.map((line) => `# ${line}`.replace(/\s+$/u, '')).join('\n');
}

