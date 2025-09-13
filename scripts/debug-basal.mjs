// Debug helper to dump basal segments for a given day
// Usage: node scripts/debug-basal.mjs 2025-08-20
import Nightscout from '../dist/clients/nightscout.js';
import BasalClient from '../dist/resources/basal/basal.js';
import ProfileClient from '../dist/resources/profiles/profiles.js';

async function main() {
  const date = process.argv[2] || '2025-08-20';
  const ns = new Nightscout();
  const profiles = new ProfileClient(ns);
  const profile = await profiles.fetchLatestProfile();
  const tz = profile.tz;
  const basal = new BasalClient(ns);
  const result = await basal.computeBasalDay(date, tz);
  const { segments } = result.data;
  const total = result.meta.sum;
  console.log('Date:', date, 'TZ:', tz);
  console.log('Segments:', segments.length, 'Total U:', total.toFixed(3));
  for (const s of segments) {
    console.log(
      [
        s.start_humanized,
        '→',
        s.stop_humanized,
        'rate',
        s.rate_U_per_h,
        'u/h',
        'U',
        s.total_U,
        '[' + s.notes + ']',
      ].join(' '),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

