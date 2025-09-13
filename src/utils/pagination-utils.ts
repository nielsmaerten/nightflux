/**
 * Common pagination patterns for Nightscout API queries.
 */

export interface PaginationConfig {
  pageSize?: number;
  maxPages?: number;
}

export interface TimeWindow {
  startMs: number;
  endMs: number;
}

export type CursorStrategy = 'mills' | 'date' | 'created_at';

export type QueryStrategy = CursorStrategy | 'fallback_scan';
export const DEFAULT_STRATEGIES: ReadonlyArray<QueryStrategy> = [
  'mills',
  'date',
  'created_at',
  'fallback_scan',
];

/**
 * Build query parameters for cursor-based pagination with time windows.
 */
export function buildCursorParams(
  strategy: CursorStrategy,
  timeWindow: TimeWindow,
  cursor: number | string,
  pageSize: number,
  additionalParams: string[] = [],
): string[] {
  const params: string[] = [`count=${pageSize}`, ...additionalParams];

  if (strategy === 'created_at') {
    const startIso = new Date(timeWindow.startMs).toISOString();
    params.push(`find[created_at][$gte]=${encodeURIComponent(startIso)}`);
    params.push(`find[created_at][$lt]=${encodeURIComponent(cursor as string)}`);
  } else {
    params.push(`find[${strategy}][$gte]=${timeWindow.startMs}`);
    params.push(`find[${strategy}][$lt]=${cursor}`);
  }

  return params;
}

/**
 * Initialize cursor for descending pagination.
 */
export function initializeCursor(strategy: CursorStrategy, endMs: number): number | string {
  return strategy === 'created_at' ? new Date(endMs).toISOString() : endMs + 1;
}

/**
 * Update cursor to the oldest timestamp seen in a page.
 */
export function updateCursor(
  strategy: CursorStrategy,
  currentCursor: number | string,
  timestampMs: number,
): number | string {
  if (strategy === 'created_at') {
    const isoTimestamp = new Date(timestampMs).toISOString();
    if (typeof currentCursor === 'string' && isoTimestamp < currentCursor) {
      return isoTimestamp;
    }
    return currentCursor;
  } else {
    if (typeof currentCursor === 'number' && timestampMs < currentCursor) {
      return timestampMs;
    }
    return currentCursor;
  }
}

/**
 * Check if pagination should continue based on cursor advancement.
 */
export function shouldContinuePagination(
  strategy: CursorStrategy,
  oldCursor: number | string,
  newCursor: number | string,
  timeWindow: TimeWindow,
): boolean {
  if (strategy === 'created_at') {
    if (typeof newCursor !== 'string' || newCursor >= (oldCursor as string)) return false;
    return newCursor > new Date(timeWindow.startMs).toISOString();
  } else {
    if (typeof newCursor !== 'number' || newCursor >= (oldCursor as number)) return false;
    return newCursor > timeWindow.startMs;
  }
}

/**
 * Generic fallback scan for when cursor-based pagination fails.
 */
export interface FallbackScanConfig<T, R> {
  pageSize: number;
  maxPages: number;
  timeWindow: TimeWindow;
  apiPath: (skip: number) => string;
  extractItems: (page: T[]) => R[];
  getTimestamp: (item: R) => number | undefined;
}

export async function fallbackScan<T, R>(
  queryFn: (path: string) => Promise<T[]>,
  config: FallbackScanConfig<T, R>,
): Promise<R[]> {
  const results: R[] = [];
  let skip = 0;

  for (let pageIndex = 0; pageIndex < config.maxPages; pageIndex++) {
    const path = config.apiPath(skip);
    const page = await queryFn(path);
    if (!Array.isArray(page) || page.length === 0) break;

    let reachedOlder = false;
    const items = config.extractItems(page);

    for (const item of items) {
      const timestamp = config.getTimestamp(item);
      if (typeof timestamp !== 'number') continue;

      if (timestamp < config.timeWindow.startMs) reachedOlder = true;
      if (timestamp >= config.timeWindow.startMs && timestamp <= config.timeWindow.endMs) {
        results.push(item);
      }
    }

    if (page.length < config.pageSize) break;
    skip += config.pageSize;
    if (reachedOlder) break;
  }

  return results;
}
