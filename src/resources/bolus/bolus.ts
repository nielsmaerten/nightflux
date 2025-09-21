import Nightscout from '../../clients/nightscout.js';
import { BolusArraySchema } from '../../domain/schema.js';
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
  insulin?: number; // immediate units
  insulinExtended?: number; // extended units
  mills?: number; // ms since epoch
  date?: number; // ms since epoch
  created_at?: string; // ISO timestamp
  eventType?: string;
  isValid?: boolean;
};

export type BolusEntry = { utc_time: number; local_time: string; units: number };

function totalInsulin(treatment: NsTreatment): number {
  if (treatment.isValid === false) return 0;
  const immediateInsulin = typeof treatment.insulin === 'number' ? treatment.insulin : 0;
  const extendedInsulin =
    typeof treatment.insulinExtended === 'number' ? treatment.insulinExtended : 0;
  return immediateInsulin + extendedInsulin;
}

export default class BolusClient {
  constructor(private ns: Nightscout) {}

  /**
   * Fetch a few raw bolus-related treatments, unfiltered.
   */
  async getRaw(count = 10): Promise<NsTreatment[]> {
    const path = `/api/v1/treatments.json?count=${Math.max(1, Math.min(count, 1000))}`;
    return this.ns.query<NsTreatment[]>(path);
  }

  /**
   * Fetch bolus events between [start, end] epoch seconds (inclusive).
   */
  async getBetween(start: number, end: number, tz: string): Promise<BolusEntry[]> {
    validateTimeRange(start, end);
    assertValidTimezone(tz);

    const startMs = Math.floor(start * 1000);
    const endMs = Math.floor(end * 1000);

    let aggregated: BolusEntry[] = [];
    for (const strategy of DEFAULT_STRATEGIES) {
      aggregated = await this.#fetchStrategy(strategy, startMs, endMs, tz);
      if (aggregated.length > 0) break;
    }

    // Dedup and sort
    const deduped = dedupByKey(
      aggregated,
      (entry) => entry.utc_time * 1_000_000 + Math.round(entry.units * 1000),
    );
    const sorted = sortByUtcTime(deduped);

    return validateWithSchema(sorted, BolusArraySchema, 'bolus');
  }

  async #fetchStrategy(
    strategy: QueryStrategy,
    startMs: number,
    endMs: number,
    tz: string,
  ): Promise<BolusEntry[]> {
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
          .map((treatment) => {
            const iu = totalInsulin(treatment);
            const ms = resolveTreatmentTimestampMs(treatment);
            return iu > 0 && ms
              ? {
                  utc_time: Math.floor(ms / 1000),
                  local_time: formatInTimeZone(
                    new Date(ms),
                    tz,
                    "yyyy-MM-dd'T'HH:mm:ssXXX",
                  ),
                  units: iu,
                }
              : null;
          })
          .filter((entry): entry is BolusEntry => entry !== null),
      );
    }

    // Cursor-based fetching
    const out: BolusEntry[] = [];
    let cursor = initializeCursor(strategy, endMs);

    for (let pageNo = 0; pageNo < maxPages; pageNo++) {
      const params = buildCursorParams(
        strategy,
        timeWindow,
        cursor,
        count,
        ['find[insulin][$gt]=0'], // primary server-side narrowing
      );
      const path = `/api/v1/treatments.json?${params.join('&')}`;
      const page = await this.ns.query<NsTreatment[]>(path);
      if (!Array.isArray(page) || page.length === 0) break;

      let oldest = cursor;
      for (const treatment of page) {
        const ms = resolveTreatmentTimestampMs(treatment);
        if (typeof ms !== 'number') continue;
        if (ms < startMs || ms > endMs) continue;
        const iu = totalInsulin(treatment);
        if (iu <= 0) continue;
        out.push({
          utc_time: Math.floor(ms / 1000),
          local_time: formatInTimeZone(new Date(ms), tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
          units: iu,
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
