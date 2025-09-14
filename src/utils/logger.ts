let quiet = false;
let progressActive = false;
let progressLabel = '';
let progressTotal = 0;
let progressCurrent = 0;
let inlineActive = false;
let inlinePrefix = '';

export function setQuiet(isQuiet: boolean): void {
  quiet = !!isQuiet;
}

export function info(message: string): void {
  if (quiet) return;
  // Ensure any active progress line is finalized before normal output
  if (progressActive) {
    process.stderr.write('\n');
    progressActive = false;
  }
  if (inlineActive) {
    process.stderr.write('\n');
    inlineActive = false;
    inlinePrefix = '';
  }
  process.stderr.write(String(message) + '\n');
}

export function infoInlineStart(message: string): void {
  if (quiet) return;
  if (progressActive) {
    process.stderr.write('\n');
    progressActive = false;
  }
  inlineActive = true;
  inlinePrefix = String(message);
  process.stderr.write(inlinePrefix);
}

export function infoInlineDone(doneSuffix: string): void {
  if (quiet) return;
  if (!inlineActive) {
    // Fallback to normal info if no inline start
    info(doneSuffix);
    return;
  }
  const line = `${inlinePrefix} ${doneSuffix}`;
  process.stderr.write(`\r${line}\n`);
  inlineActive = false;
  inlinePrefix = '';
}

export function startProgress(label: string, total: number): void {
  if (quiet) return;
  if (inlineActive) {
    process.stderr.write('\n');
    inlineActive = false;
    inlinePrefix = '';
  }
  progressActive = true;
  progressLabel = label;
  progressTotal = Math.max(0, Math.floor(total));
  progressCurrent = 0;
  renderProgress();
}

export function tickProgress(step = 1): void {
  if (quiet || !progressActive) return;
  progressCurrent += Math.max(0, Math.floor(step));
  if (progressCurrent > progressTotal) progressCurrent = progressTotal;
  renderProgress();
}

export function endProgress(message?: string): void {
  if (quiet) return;
  if (progressActive) {
    // Render final state, then newline and optional trailing message
    renderProgress();
    process.stderr.write('\n');
    progressActive = false;
  }
  if (message) process.stderr.write(String(message) + '\n');
}

function renderProgress(): void {
  // Simplistic single-line progress indicator
  const total = progressTotal || 0;
  const current = Math.min(progressCurrent, total);
  const pct = total > 0 ? Math.floor((current / total) * 100) : 0;
  const line = `${progressLabel} ${current}/${total} (${pct}%)`;
  // Clear the line and rewrite
  process.stderr.write(`\r${line}`);
}

export default {
  setQuiet,
  info,
  infoInlineStart,
  infoInlineDone,
  startProgress,
  tickProgress,
  endProgress,
};
