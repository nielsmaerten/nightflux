import Nightscout from '../../clients/nightscout.js';
import { CarbsArraySchema } from '../../domain/schema.js';
import { resolveTreatmentTimestampMs } from '../../utils/nightscout-utils.js';
import {
  validateTimeRange,
  validateWithSchema,
  dedupByKey,
  sortByUtcTime,
} from '../../utils/common-utils.js';
import { formatInTimeZone } from 'date-fns-tz';
import { assertValidTimezone } from '../../utils/timezones.js';
import {
  buildCursorParams,
  initializeCursor,
  updateCursor,
  shouldContinuePagination,
  fallbackScan,
  DEFAULT_STRATEGIES,
  type TimeWindow,
  type QueryStrategy,
} from '../../utils/pagination-utils.js';

type NsTreatment = {
  carbs?: number; // grams
  mills?: number; // ms since epoch
  date?: number; // some installations include date (ms)
  created_at?: string; // ISO timestamp
  eventType?: string;
};

export type CarbEntry = { utc_time: number; local_time: string; grams: number };

export default class CarbsClient {
  constructor(private ns: Nightscout) {}

  /**
   * Fetch a small number of raw treatments without filtering.
   * Useful for inspecting the shape of your Nightscout data.
   */
  async getRaw(count = 10): Promise<NsTreatment[]> {
    const path = `/api/v1/treatments.json?count=${Math.max(1, Math.min(count, 1000))}`;
    return this.ns.query<NsTreatment[]>(path);
  }

  /**
   * Fetch carbohydrate intake events between [start, end] epoch seconds (inclusive).
   */
  async getBetween(start: number, end: number, tz: string): Promise<CarbEntry[]> {
    validateTimeRange(start, end);
    assertValidTimezone(tz);

    const startMs = Math.floor(start * 1000);
    const endMs = Math.floor(end * 1000);

    // Run multiple strategies to accommodate varying field availability
    let aggregated: CarbEntry[] = [];
    for (const strategy of DEFAULT_STRATEGIES) {
      aggregated = await this.#fetchStrategy(strategy, startMs, endMs, tz);
      if (aggregated.length > 0) break;
    }

    // De-duplicate and sort
    const deduped = dedupByKey(aggregated, (entry) => `${entry.utc_time}:${entry.grams}`);
    const sorted = sortByUtcTime(deduped);

    return validateWithSchema(sorted, CarbsArraySchema, 'carb');
  }

  async #fetchStrategy(
    strategy: QueryStrategy,
    startMs: number,
    endMs: number,
    tz: string,
  ): Promise<CarbEntry[]> {
    const count = 1000;
    const maxPages = 100;
    const timeWindow: TimeWindow = { startMs, endMs };

    if (strategy === 'fallback_scan') {
      return fallbackScan((path) => this.ns.query<NsTreatment[]>(path), {
        pageSize: count,
        maxPages,
        timeWindow,
        apiPath: (skip) => `/api/v1/treatments.json?count=${count}&skip=${skip}`,
        extractItems: (page) => page,
        getTimestamp: resolveTreatmentTimestampMs,
      }).then((treatments) =>
        treatments
          .filter((treatment) => typeof treatment.carbs === 'number' && treatment.carbs > 0)
          .map((treatment) => {
            const ms = resolveTreatmentTimestampMs(treatment);
            return ms
              ? {
                  utc_time: Math.floor(ms / 1000),
                  local_time: formatInTimeZone(
                    new Date(ms),
                    tz,
                    "yyyy-MM-dd'T'HH:mm:ssXXX",
                  ),
                  grams: treatment.carbs!,
                }
              : null;
          })
          .filter((entry): entry is CarbEntry => entry !== null),
      );
    }

    // Field-filtered strategy with descending cursor
    const out: CarbEntry[] = [];
    let cursor = initializeCursor(strategy, endMs);

    for (let pageNo = 0; pageNo < maxPages; pageNo++) {
      const params = buildCursorParams(strategy, timeWindow, cursor, count, ['find[carbs][$gt]=0']);
      const path = `/api/v1/treatments.json?${params.join('&')}`;
      const page = await this.ns.query<NsTreatment[]>(path);
      if (!Array.isArray(page) || page.length === 0) break;

      let oldest = cursor;
      for (const treatment of page) {
        if (typeof treatment.carbs !== 'number' || !(treatment.carbs > 0)) continue;
        const ms = resolveTreatmentTimestampMs(treatment);
        if (typeof ms !== 'number') continue;
        if (ms < startMs || ms > endMs) continue;
        out.push({
          utc_time: Math.floor(ms / 1000),
          local_time: formatInTimeZone(new Date(ms), tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
          grams: treatment.carbs,
        });
        oldest = updateCursor(strategy, oldest, ms);
      }

      if (!shouldContinuePagination(strategy, cursor, oldest, timeWindow)) break;
      cursor = oldest;
      if (page.length < count) break;
    }

    return out;
  }
}
