import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import Nightscout from '../../clients/nightscout';
import BolusClient from './bolus';
import { BolusArraySchema } from '../../domain/schema';

describe('Nightscout Bolus (integration)', () => {
  it('fetches bolus entries for the last 30 days', async () => {
    const ns = new Nightscout();
    const bolusClient = new BolusClient(ns);
    const nowSec = Math.floor(Date.now() / 1000);
    const start = nowSec - 30 * 24 * 3600;
    const end = nowSec + 60; // small cushion

    const entries = await bolusClient.getBetween(start, end);

    const parsed = BolusArraySchema.safeParse(entries);
    expect(parsed.success).toBe(true);

    // Expect at least one bolus event in this range on the test server
    expect(entries.length).toBeGreaterThan(0);

    // Bounds and order checks
    let prevT = -Infinity;
    for (const entry of entries) {
      expect(entry.t).toBeGreaterThanOrEqual(start);
      expect(entry.t).toBeLessThanOrEqual(end);
      expect(entry.iu).toBeGreaterThan(0);
      expect(entry.t).toBeGreaterThanOrEqual(prevT);
      prevT = entry.t;
    }
  });
});
