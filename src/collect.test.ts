import 'dotenv/config';
import { describe, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import collectExport from './collect.js';

describe('Collect Export (integration)', () => {
  it('produces an export for 2025-08-10..2025-09-10', async () => {
    const url = process.env.NIGHTSCOUT_URL;
    if (!url) {
      console.warn('NIGHTSCOUT_URL not set; skipping collect export integration test.');
      return;
    }

    const start = '2025-08-10';
    const end = '2025-09-10';
    const data = await collectExport(url, start, end);

    // Print a concise per-day summary to aid manual comparison
    console.log(
      `\nCollectExport summary: profiles=${data.profiles.length}, days=${data.days.length}`,
    );
    for (const day of data.days) {
      const tz = day.date.timezone;
      const dateStr = formatInTimeZone(new Date(day.date.t * 1000), tz, 'yyyy-MM-dd');
      const cgmCount = day.cgm.length;
      const carbsTotal = day.carbs.reduce((a, e) => a + (e.g || 0), 0);
      const bolusTotal = day.bolus.reduce((a, e) => a + (e.iu || 0), 0);
      const basalTotal = day.basal.reduce((a, e) => a + (e.iu_sum || 0), 0);
      const ttd = bolusTotal + basalTotal;
      console.log(
        `${dateStr} | cgm=${cgmCount} carbs=${carbsTotal.toFixed(0)}g bolus=${bolusTotal.toFixed(2)}U basal=${basalTotal.toFixed(2)}U profiles=${day.activeProfiles.length} TTD=${ttd.toFixed(2)}U`,
      );
    }
  }, 180_000);
});
