import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import Nightscout from '../../clients/nightscout';
import CarbsClient from './carbs';
import { CarbsArraySchema } from '../../domain/schema';

describe('Nightscout Carbs (integration)', () => {
  it('fetches carb entries for the last 30 days', async () => {
    const ns = new Nightscout();
    const carbsClient = new CarbsClient(ns);
    const nowSec = Math.floor(Date.now() / 1000);
    const start = nowSec - 30 * 24 * 3600;
    const end = nowSec + 60; // small cushion

    const entries = await carbsClient.getBetween(start, end);

    const parsed = CarbsArraySchema.safeParse(entries);
    expect(parsed.success).toBe(true);

    // Expect at least one carb event in this range on the test server
    expect(entries.length).toBeGreaterThan(0);

    // Bounds and order checks
    let prevT = -Infinity;
    for (const entry of entries) {
      expect(entry.t).toBeGreaterThanOrEqual(start);
      expect(entry.t).toBeLessThanOrEqual(end);
      expect(entry.g).toBeGreaterThan(0);
      expect(entry.t).toBeGreaterThanOrEqual(prevT);
      prevT = entry.t;
    }
  });
});
