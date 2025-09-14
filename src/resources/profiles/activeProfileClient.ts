import { NightscoutClientBase } from '../../clients/nightscout.js';
import { ActiveProfileSchema } from '../../domain/schema.js';
import {
  resolveTreatmentTimestampMs,
  resolveProfileIdFromTreatment,
  resolveProfilePercent,
  dedupConsecutiveStates,
} from '../../utils/nightscout-utils.js';
import { validateEachWithSchema } from '../../utils/common-utils.js';
import { NsTreatment } from '../../domain/ns-types.js';
import { DEFAULT_STRATEGIES, type QueryStrategy } from '../../utils/pagination-utils.js';

export type ActiveProfile = { id: string; pct: number; start: number };

/**
 * Client for reading active profile switches from Nightscout.
 */
export default class ActiveProfileClient extends NightscoutClientBase {
  /**
   * Fetch active profile timeline between [start, end] epoch seconds.
   *
   * Returns the time-ordered activation timeline, i.e. when a profile (and optional
   * percentage) became active. This is complementary to
   * ProfileClient.getProfileDefinitionsBetween, which returns the static profile
   * definitions (name, tz, blocks). Combine both by matching on `id`.
   *
   * Details:
   * - Seeds the timeline with the last switch before start.
   * - Ensures the first entry starts exactly at `start`.
   */
  async getActiveProfileTimelineBetween(
    startSec: number,
    endSec: number,
  ): Promise<ActiveProfile[]> {
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
      throw new Error('start and end must be finite epoch seconds');
    }
    if (startSec > endSec) throw new Error('start must be <= end');

    const startMs = Math.floor(startSec * 1000);
    const endMs = Math.floor(endSec * 1000);

    const seed = await this.fetchLastSwitchBefore(startMs);
    const switches = await this.fetchSwitchesBetween(startMs, endMs);

    const timeline: ActiveProfile[] = [];
    timeline.push({ id: seed?.id || 'unknown', pct: seed?.pct ?? 100, start: startSec });
    for (const profileEvent of switches) {
      if (profileEvent.t < startSec) continue;
      const last = timeline[timeline.length - 1];
      if (!last || last.id !== profileEvent.id || last.pct !== profileEvent.pct) {
        timeline.push({ id: profileEvent.id, pct: profileEvent.pct, start: profileEvent.t });
      }
    }

    // Validate
    validateEachWithSchema(timeline, ActiveProfileSchema, 'active profile');
    return timeline;
  }

  // Internals

  /**
   * Retrieve profile switch events between two millisecond timestamps using multiple strategies.
   * Returns a sorted list of state changes (seconds precision).
   */
  private async fetchSwitchesBetween(
    startMs: number,
    endMs: number,
  ): Promise<Array<{ t: number; id: string; pct: number }>> {
    for (const strategyName of DEFAULT_STRATEGIES) {
      const found = await this.fetchBetweenStrategy(strategyName, startMs, endMs);
      if (found.length > 0) return found;
    }
    return [];
  }

  /**
   * Fetch switches using a specific strategy:
   * - mills/date numeric windows or created_at ISO windows using a descending cursor
   * - fallback_scan when server cannot filter reliably
   */
  private async fetchBetweenStrategy(
    strategy: QueryStrategy,
    startMs: number,
    endMs: number,
  ): Promise<Array<{ t: number; id: string; pct: number }>> {
    const output: Array<{ t: number; id: string; pct: number }> = [];
    const pageSize = 1000;
    const maxPages = 100;
    const isProfileSwitch = (t: NsTreatment) =>
      (t.eventType || '').toLowerCase() === 'profile switch';

    if (strategy === 'fallback_scan') {
      let skip = 0;
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
        const path = `/api/v1/treatments.json?count=${pageSize}&skip=${skip}&find[eventType]=${encodeURIComponent('Profile Switch')}`;
        const page = await this.ns.query<NsTreatment[]>(path);
        if (!Array.isArray(page) || page.length === 0) break;
        let reachedOlder = false;
        for (const treatment of page) {
          if (!isProfileSwitch(treatment)) continue;
          const tsMs = resolveTreatmentTimestampMs(treatment);
          if (typeof tsMs !== 'number') continue;
          if (tsMs < startMs) reachedOlder = true;
          if (tsMs >= startMs && tsMs <= endMs) {
            const profileId = resolveProfileIdFromTreatment(treatment) || 'unknown';
            const percent = resolveProfilePercent(treatment);
            output.push({ t: Math.floor(tsMs / 1000), id: profileId, pct: percent });
          }
        }
        if (page.length < pageSize) break;
        skip += pageSize;
        if (reachedOlder) break;
      }
      output.sort((a, b) => a.t - b.t);
      return dedupConsecutiveStates(output);
    }

    // Cursor-based descending fetch
    let cursor: number | string =
      strategy === 'created_at' ? new Date(endMs).toISOString() : endMs + 1;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const params: string[] = [
        `count=${pageSize}`,
        `find[eventType]=${encodeURIComponent('Profile Switch')}`,
      ];
      if (strategy === 'created_at') {
        const startIso = new Date(startMs).toISOString();
        params.push(`find[created_at][$gte]=${encodeURIComponent(startIso)}`);
        params.push(`find[created_at][$lt]=${encodeURIComponent(cursor as string)}`);
      } else {
        params.push(`find[${strategy}][$gte]=${startMs}`);
        params.push(`find[${strategy}][$lt]=${cursor}`);
      }
      const path = `/api/v1/treatments.json?${params.join('&')}`;
      const page = await this.ns.query<NsTreatment[]>(path);
      if (!Array.isArray(page) || page.length === 0) break;

      let oldest: number | string = cursor;
      for (const treatment of page) {
        if (!isProfileSwitch(treatment)) continue;
        const tsMs = resolveTreatmentTimestampMs(treatment);
        if (typeof tsMs !== 'number') continue;
        if (tsMs < startMs || tsMs > endMs) continue;
        const profileId = resolveProfileIdFromTreatment(treatment) || 'unknown';
        const percent = resolveProfilePercent(treatment);
        output.push({ t: Math.floor(tsMs / 1000), id: profileId, pct: percent });

        if (strategy === 'created_at') {
          const createdAt =
            typeof treatment.created_at === 'string'
              ? treatment.created_at
              : new Date(tsMs).toISOString();
          if (typeof oldest === 'string' && createdAt < oldest) oldest = createdAt;
        } else if (typeof oldest === 'number') {
          if (tsMs < oldest) oldest = tsMs;
        }
      }

      if (strategy === 'created_at') {
        if (typeof oldest !== 'string' || oldest >= (cursor as string)) break;
        cursor = oldest as string;
        if ((oldest as string) <= new Date(startMs).toISOString()) break;
      } else {
        if (typeof oldest !== 'number' || oldest >= (cursor as number)) break;
        cursor = oldest as number;
        if ((cursor as number) <= startMs) break;
      }

      if (page.length < pageSize) break;
    }

    output.sort((a, b) => a.t - b.t);
    return dedupConsecutiveStates(output);
  }

  /**
   * Find the most recent switch at or before the given millisecond timestamp.
   */
  private async fetchLastSwitchBefore(
    startMs: number,
  ): Promise<{ id: string; pct: number; ms: number } | undefined> {
    for (const strategyName of DEFAULT_STRATEGIES) {
      const found = await this.fetchLastBeforeStrategy(strategyName, startMs);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Strategy-specific lookup for last switch before startMs.
   */
  private async fetchLastBeforeStrategy(
    strategy: QueryStrategy,
    startMs: number,
  ): Promise<{ id: string; pct: number; ms: number } | undefined> {
    const pageSize = 1000;
    const maxPages = 10;
    const isProfileSwitch = (t: NsTreatment) =>
      (t.eventType || '').toLowerCase() === 'profile switch';

    if (strategy === 'fallback_scan') {
      let skip = 0;
      let best: { id: string; pct: number; ms: number } | undefined;
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
        const path = `/api/v1/treatments.json?count=${pageSize}&skip=${skip}&find[eventType]=${encodeURIComponent('Profile Switch')}`;
        const page = await this.ns.query<NsTreatment[]>(path);
        if (!Array.isArray(page) || page.length === 0) break;
        let reachedMuchOlder = false;
        for (const treatment of page) {
          if (!isProfileSwitch(treatment)) continue;
          const tsMs = resolveTreatmentTimestampMs(treatment);
          if (typeof tsMs !== 'number') continue;
          if (tsMs <= startMs) {
            if (!best || tsMs > best.ms) {
              const profileId = resolveProfileIdFromTreatment(treatment) || 'unknown';
              const percent = resolveProfilePercent(treatment);
              best = { id: profileId, pct: percent, ms: tsMs };
            }
          }
          if (best && tsMs < best.ms - 90 * 24 * 3600 * 1000) reachedMuchOlder = true;
        }
        if (page.length < pageSize) break;
        skip += pageSize;
        if (best && reachedMuchOlder) break;
      }
      return best;
    }

    let cursor: number | string =
      strategy === 'created_at' ? new Date(startMs + 1).toISOString() : startMs + 1;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const params: string[] = [
        `count=${pageSize}`,
        `find[eventType]=${encodeURIComponent('Profile Switch')}`,
      ];
      if (strategy === 'created_at') {
        params.push(`find[created_at][$lt]=${encodeURIComponent(cursor as string)}`);
      } else {
        params.push(`find[${strategy}][$lt]=${cursor}`);
      }
      const path = `/api/v1/treatments.json?${params.join('&')}`;
      const page = await this.ns.query<NsTreatment[]>(path);
      if (!Array.isArray(page) || page.length === 0) break;

      let candidate: { id: string; pct: number; ms: number } | undefined;
      let oldest: number | string = cursor;
      for (const treatment of page) {
        if (!isProfileSwitch(treatment)) continue;
        const tsMs = resolveTreatmentTimestampMs(treatment);
        if (typeof tsMs !== 'number') continue;
        if (tsMs <= startMs) {
          if (!candidate || tsMs > candidate.ms) {
            const profileId = resolveProfileIdFromTreatment(treatment) || 'unknown';
            const percent = resolveProfilePercent(treatment);
            candidate = { id: profileId, pct: percent, ms: tsMs };
          }
        }
        if (strategy === 'created_at') {
          const createdAt =
            typeof treatment.created_at === 'string'
              ? treatment.created_at
              : new Date(tsMs).toISOString();
          if (typeof oldest === 'string' && createdAt < oldest) oldest = createdAt;
        } else if (typeof oldest === 'number') {
          if (tsMs < oldest) oldest = tsMs;
        }
      }
      if (candidate) return candidate;

      if (strategy === 'created_at') {
        if (typeof oldest !== 'string' || oldest >= (cursor as string)) break;
        cursor = oldest as string;
      } else {
        if (typeof oldest !== 'number' || oldest >= (cursor as number)) break;
        cursor = oldest as number;
      }

      if (page.length < pageSize) break;
    }
    return undefined;
  }
}
