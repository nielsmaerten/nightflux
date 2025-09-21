import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';
import Nightscout from '../clients/nightscout.js';
import CarbsClient from '../resources/carbs/carbs.js';
import BolusClient from '../resources/bolus/bolus.js';
import ProfileClient from '../resources/profiles/profiles.js';
import BasalClient from '../resources/basal/basal.js';
import { toUtcRange } from '../utils/timezones.js';

// Expected output:
const days: Record<string, { carbs: number; bolus: number; basal: number }> = {
  '2025-08-18': { carbs: 143, bolus: 48.4, basal: 29 },
  '2025-08-19': { carbs: 251, bolus: 62.4, basal: 32.3 },
  '2025-08-20': { carbs: 273, bolus: 55.1, basal: 33.3 },
  '2025-08-21': { carbs: 195, bolus: 63.1, basal: 48.1 },
  '2025-08-22': { carbs: 91, bolus: 29.1, basal: 71.7 },
  '2025-08-31': { carbs: 183, bolus: 20.5, basal: 36.7 },
  '2025-09-01': { carbs: 216, bolus: 23.9, basal: 27.1 },
  '2025-09-02': { carbs: 244, bolus: 33.5, basal: 17.4 },
  '2025-09-03': { carbs: 203, bolus: 44.6, basal: 24.2 },
  '2025-09-04': { carbs: 116, bolus: 22.1, basal: 45.7 },
  '2025-09-05': { carbs: 243, bolus: 54.0, basal: 29.7 },
  '2025-09-06': { carbs: 266, bolus: 48.0, basal: 27.2 },
  '2025-09-07': { carbs: 200, bolus: 65.8, basal: 37.8 },
  '2025-09-08': { carbs: 227, bolus: 67.9, basal: 39.0 },
  '2025-09-09': { carbs: 130, bolus: 65.8, basal: 48.6 },
  '2025-09-10': { carbs: 129, bolus: 31.0, basal: 24.3 },
  '2025-09-11': { carbs: 148, bolus: 40.2, basal: 9.0 },
  '2025-09-12': { carbs: 216, bolus: 40.7, basal: 10.0 },
};

let tz = '';
let ns: Nightscout | null = null;

describe('Real world validation', () => {
  beforeAll(async () => {
    ns = new Nightscout();
    const profiles = new ProfileClient(ns);
    const profile = await profiles.fetchLatestProfile();
    tz = profile.timezone;
  });

  it('returns the expected bolus and carb totals', async () => {
    const carbs = new CarbsClient(ns!);
    const bolus = new BolusClient(ns!);

    const firstDay = Object.keys(days)[0];
    const lastDay = Object.keys(days)[Object.keys(days).length - 1];
    const { start, end } = toUtcRange(firstDay, lastDay, tz);
    const carbEntries = await carbs.getBetween(start, end, tz);
    const bolusEntries = await bolus.getBetween(start, end, tz);

    // Integration sanity
    expect(carbEntries.length).toBeGreaterThan(0);
    expect(bolusEntries.length).toBeGreaterThan(0);

    // Group carb and bolus entries into buckets by day
    const dailyCarbs = Object.keys(days).reduce(
      (acc, day) => {
        const { start, end } = toUtcRange(day, day, tz);
        acc[day] = carbEntries.filter((entry) => entry.utc_time >= start && entry.utc_time < end);
        return acc;
      },
      {} as Record<string, typeof carbEntries>,
    );

    const dailyBolus = Object.keys(days).reduce(
      (acc, day) => {
        const { start, end } = toUtcRange(day, day, tz);
        acc[day] = bolusEntries.filter((entry) => entry.utc_time >= start && entry.utc_time < end);
        return acc;
      },
      {} as Record<string, typeof bolusEntries>,
    );

    // Run assertions: totals should be within margin of error
    for (const day of Object.keys(days)) {
      const expectedCarbs = days[day].carbs;
      const expectedBolus = days[day].bolus;

      const actualCarbs = dailyCarbs[day].reduce((sum, entry) => sum + (entry.grams || 0), 0);
      const actualBolus = dailyBolus[day].reduce((sum, entry) => sum + (entry.units || 0), 0);

      // Allow small rounding errors for bolus and carbs
      expect(actualCarbs).toBe(expectedCarbs);
      expect(actualBolus).toBeCloseTo(expectedBolus, 1);
    }
  }, 60_000);

  for (const day of Object.keys(days)) {
    it(`computes basal day for ${day}`, async () => {
      const basalClient = new BasalClient(new Nightscout());
      //if (day !== '2025-08-31') return; // Temporarily limit to a single day while we verify results
      const basalDay = await basalClient.computeBasalDay(day, tz);
      const expectedBasal = days[day].basal;
      const actualBasal = basalDay.meta.sum;

      const allowedDiff = 2; // units
      const diff = actualBasal - expectedBasal;
      const fn = Math.abs(diff) > allowedDiff ? console.warn : console.log;
      const prefix = Math.abs(diff) > allowedDiff ? '❌' : '  ';
      fn(
        `${prefix}diff(${diff.toFixed(2)}) - ${day}: expected(${expectedBasal.toFixed(2)}), actual(${actualBasal.toFixed(2)})`,
      );
      if (Math.abs(diff) > allowedDiff)
        throw new Error(
          `Basal total for ${day} is off by more than ${allowedDiff} units: expected ${expectedBasal}, got ${actualBasal} (diff ${diff.toFixed(2)})`,
        );
    }, 10_000);
  }
});
