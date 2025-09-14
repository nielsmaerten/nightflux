import { NsTreatment } from '../domain/ns-types.js';

/**
 * Generic utility to resolve a value from multiple candidate fields.
 * Returns the first valid value that passes the validation function.
 */
export function resolveFromCandidates<T>(
  candidates: Array<unknown>,
  validator: (value: unknown) => value is T,
): T | undefined {
  for (const candidate of candidates) {
    if (validator(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Parse an ISO-like string into epoch milliseconds.
 * Returns undefined on invalid input.
 */
function parseIsoToMs(iso?: string): number | undefined {
  if (!iso) return undefined;
  const timestampMs = Date.parse(iso);
  return Number.isFinite(timestampMs) ? timestampMs : undefined;
}

/**
 * Resolve the best available timestamp from a treatment to milliseconds since epoch.
 */
export function resolveTreatmentTimestampMs(treatment: NsTreatment): number | undefined {
  if (typeof treatment.mills === 'number') return treatment.mills;
  if (typeof treatment.date === 'number') return treatment.date;
  if (typeof treatment.created_at === 'string') return parseIsoToMs(treatment.created_at);
  return undefined;
}

/**
 * Resolve a profile id/name from a treatment record.
 */
export function resolveProfileIdFromTreatment(treatment: NsTreatment): string | undefined {
  const candidates: Array<unknown> = [
    treatment.profile,
    treatment.profileName,
    treatment.profileSelected,
    (treatment.profile &&
      typeof treatment.profile === 'object' &&
      (treatment.profile as any).name) ||
      undefined,
  ];
  return resolveFromCandidates(
    candidates,
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )?.trim();
}

/**
 * Resolve a percentage value from a treatment. Defaults to 100 when missing.
 */
export function resolveProfilePercent(treatment: NsTreatment): number {
  const raw =
    resolveFromCandidates<number>(
      [treatment.percent, treatment.percentage, treatment.profilePercentage],
      (value): value is number => typeof value === 'number',
    ) ?? 100;
  return Math.max(0, raw);
}

/**
 * Generic pattern matching for event names.
 */
export function matchesEventPattern(
  name: string,
  exactMatches: string[],
  keywords: string[],
): boolean {
  const lowered = name.toLowerCase();
  if (exactMatches.some((val) => lowered === val)) return true;
  return keywords.every((keyword) => lowered.includes(keyword));
}

/**
 * Determine whether an event name indicates a pump suspend.
 */
export function isSuspendEventName(name: string): boolean {
  const exactMatches = [
    'pump suspend',
    'suspend pump',
    'pump suspended',
    'temporary pump suspend',
    'stop pump',
    'pump stopped',
  ];
  return matchesEventPattern(name, exactMatches, ['suspend', 'pump']);
}

/**
 * Determine whether an event name indicates a pump resume.
 */
export function isResumeEventName(name: string): boolean {
  const exactMatches = ['pump resume', 'resume pump', 'pump resumed', 'start pump', 'pump started'];
  return matchesEventPattern(name, exactMatches, ['resume', 'pump']);
}

/**
 * Remove consecutive duplicate states (same id and pct) from a timeline array.
 */
export function dedupConsecutiveStates<T extends { id: string; pct: number }>(
  timeline: Array<T>,
): Array<T> {
  if (timeline.length === 0) return timeline;
  const result: Array<T> = [];
  let last: T | undefined;
  for (const item of timeline) {
    if (!last || last.id !== item.id || last.pct !== item.pct) {
      result.push(item);
      last = item;
    }
  }
  return result;
}
