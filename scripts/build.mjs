#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds using the repo's TypeScript when present, otherwise falls back to npm exec.
const filePath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(filePath), '..');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const tscBinary = resolve(projectRoot, 'node_modules', '.bin', isWindows ? 'tsc.cmd' : 'tsc');

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (existsSync(tscBinary)) {
  run(tscBinary, ['-p', 'tsconfig.json']);
} else {
  console.warn('TypeScript not found in node_modules, using npm exec to download a temporary compiler.');
  run(npmCommand, ['exec', '--yes', '--package', 'typescript', '--', 'tsc', '-p', 'tsconfig.json']);
}
