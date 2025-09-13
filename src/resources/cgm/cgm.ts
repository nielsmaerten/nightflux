import Nightscout from '../../clients/nightscout';
import { CgmArraySchema } from '../../domain/schema';
import { validateTimeRange, validateWithSchema, dedupByTimestamp } from '../../utils/common-utils';

type NsEntry = {
  date: number; // ms since epoch
  sgv?: number; // mg/dL
  type?: string;
};

export type CgmEntry = { t: number; mgDl: number };

export default class CgmClient {
  constructor(private ns: Nightscout) {}

  /**
   * Fetch CGM entries between start and end (epoch seconds, inclusive),
   * paginate if needed, transform and validate against CgmArraySchema.
   */
  async getBetween(start: number, end: number): Promise<CgmEntry[]> {
    validateTimeRange(start, end);

    const startMs = Math.floor(start * 1000);
    const endMs = Math.floor(end * 1000);

    const count = 1000; // Nightscout max page size
    let cursorMs = endMs + 1; // use < cursor for pagination
    const results: CgmEntry[] = [];
    const maxPages = 100; // safety guard

    for (let pageNo = 0; pageNo < maxPages; pageNo++) {
      const path = `/api/v1/entries.json?find[date][$gte]=${startMs}&find[date][$lt]=${cursorMs}&count=${count}`;
      const page = await this.ns.query<NsEntry[]>(path);
      if (!Array.isArray(page) || page.length === 0) break;

      let oldest = cursorMs;
      for (const entry of page) {
        if (typeof entry?.date !== 'number') continue;
        if (typeof entry?.sgv !== 'number') continue; // skip non-SGV entries
        if (entry.date < startMs || entry.date > endMs) continue; // enforce bounds strictly

        const timestamp = Math.floor(entry.date / 1000);
        const mgDl = entry.sgv;
        results.push({ t: timestamp, mgDl });
        if (entry.date < oldest) oldest = entry.date;
      }

      // Move cursor (strictly older than oldest we saw)
      if (oldest >= cursorMs) break;
      cursorMs = oldest;
      if (page.length < count) break; // last page
      if (cursorMs <= startMs) break; // we paged past the start
    }

    // De-duplicate by timestamp and sort
    const sorted = dedupByTimestamp(results);

    return validateWithSchema(sorted, CgmArraySchema, 'CGM');
  }
}
