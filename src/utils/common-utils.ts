import { ZodSchema } from 'zod';

function validateRange(start: number, end: number, strict: boolean): void {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('start and end must be finite epoch seconds');
  }
  if (strict ? start >= end : start > end) {
    throw new Error(strict ? 'start must be < end' : 'start must be <= end');
  }
}

/**
 * Common validation for start/end epoch seconds parameters.
 */
export function validateTimeRange(start: number, end: number): void {
  validateRange(start, end, false);
}

/**
 * Common validation for start/end epoch seconds parameters where start must be strictly less than end.
 */
export function validateTimeRangeStrict(start: number, end: number): void {
  validateRange(start, end, true);
}

/**
 * Generic schema validation with consistent error formatting.
 */
export function validateWithSchema<T>(data: unknown, schema: ZodSchema<T>, entityType: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid transformed ${entityType} entries: ${issues}`);
  }
  return parsed.data;
}

/**
 * Validate each item in an array individually against a schema.
 */
export function validateEachWithSchema<T>(
  items: unknown[],
  schema: ZodSchema<T>,
  entityType: string,
): T[] {
  const results: T[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid ${entityType} item: ${issues}`);
    }
    results.push(parsed.data);
  }
  return results;
}

/**
 * Generic deduplication by custom key function.
 */
export function dedupByKey<T>(entries: T[], keyFn: (entry: T) => string | number): T[] {
  const dedup = new Map<string | number, T>();
  for (const entry of entries) {
    dedup.set(keyFn(entry), entry);
  }
  return Array.from(dedup.values());
}

/**
 * Generic deduplication by timestamp for entries with a 'utc_time' field.
 */
export function dedupByUtcTime<T extends { utc_time: number }>(entries: T[]): T[] {
  const dedup = new Map<number, T>();
  for (const entry of entries) {
    dedup.set(entry.utc_time, entry);
  }
  return Array.from(dedup.values()).sort((a, b) => a.utc_time - b.utc_time);
}

/**
 * Sort entries by timestamp (entries with 'utc_time' field).
 */
export function sortByUtcTime<T extends { utc_time: number }>(entries: T[]): T[] {
  return entries.sort((a, b) => a.utc_time - b.utc_time);
}
