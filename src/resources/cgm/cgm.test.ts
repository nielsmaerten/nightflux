import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import Nightscout from '../../clients/nightscout.js';
import CgmClient from './cgm';
import { CgmArraySchema } from '../../domain/schema';
import ProfileClient from '../profiles/profiles.js';
import { formatInTimeZone } from 'date-fns-tz';

describe('Nightscout CGM (integration)', () => {
  it('fetches CGM entries for the last 24h', async () => {
    const ns = new Nightscout();
    const cgm = new CgmClient(ns);
    const profileClient = new ProfileClient(ns);
    const latestProfile = await profileClient.fetchLatestProfile();
    const tz = latestProfile.timezone;
    const nowSec = Math.floor(Date.now() / 1000);
    const start = nowSec - 24 * 3600;
    const end = nowSec + 60; // small cushion

    const entries = await cgm.getBetween(start, end, tz);

    // Schema validation
    const parsed = CgmArraySchema.safeParse(entries);
    expect(parsed.success).toBe(true);

    // Expect at least some readings in the period
    expect(entries.length).toBeGreaterThan(0);

    // Bounds and order checks
    let prevT = -Infinity;
    for (const entry of entries) {
      expect(entry.utc_time).toBeGreaterThanOrEqual(start);
      expect(entry.utc_time).toBeLessThanOrEqual(end);
      expect(entry.mgDl).toBeGreaterThanOrEqual(0);
      expect(entry.utc_time).toBeGreaterThanOrEqual(prevT);
      expect(entry.local_time).toBe(
        formatInTimeZone(new Date(entry.utc_time * 1000), tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      );
      prevT = entry.utc_time;
    }
  });
});
