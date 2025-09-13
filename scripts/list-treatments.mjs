// Dump distinct treatment types and some fields for a given local day
// Usage: node scripts/list-treatments.mjs 2025-08-20 Europe/Brussels
import axios from 'axios';
import { ProxyAgent } from 'proxy-agent';

function resolveBaseAndToken(raw) {
  const url = new URL(raw);
  const token = url.searchParams.get('token');
  url.searchParams.delete('token');
  return { base: url.toString(), token };
}

function buildClient(base, token) {
  const agent = new ProxyAgent();
  const client = axios.create({ baseURL: base, httpAgent: agent, httpsAgent: agent, proxy: false });
  client.interceptors.request.use((config) => {
    config.headers = { ...(config.headers || {}), accept: 'application/json' };
    const params = new URLSearchParams(config.params || {});
    if (!params.has('token')) params.set('token', token);
    config.params = params;
    return config;
  });
  return client;
}

function localIso(dateStr, tzOffset) {
  return `${dateStr}T00:00:00${tzOffset}`;
}

async function main() {
  const dateStr = process.argv[2] || '2025-08-20';
  const tzOffset = process.argv[3] || '+02:00'; // Europe/Brussels in Aug is CEST
  if (!process.env.NIGHTSCOUT_URL) throw new Error('NIGHTSCOUT_URL is required');
  const { base, token } = resolveBaseAndToken(process.env.NIGHTSCOUT_URL);
  const client = buildClient(base, token);
  const startISO = localIso(dateStr, tzOffset);
  // End is next day 00:00
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const endDate = new Date(Date.UTC(y, m - 1, d) + 24 * 3600 * 1000);
  const endISO = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}T00:00:00${tzOffset}`;

  const { data } = await client.get('/api/v1/treatments.json', {
    params: {
      'find[created_at][$gte]': startISO,
      'find[created_at][$lt]': endISO,
      count: 1000,
      sort$desc: false,
    },
  });
  const events = data.map((t) => ({
    t: t.created_at,
    eventType: t.eventType,
    absolute: t.absolute ?? t.rate,
    percent: t.percent,
    relative: t.relative,
    duration: t.duration ?? t.durationMinutes ?? Math.round((t.durationInMilliseconds || 0) / 60000),
    _id: t._id,
  }));

  const byType = new Map();
  for (const e of events) {
    const key = String(e.eventType || '').toLowerCase();
    byType.set(key, (byType.get(key) || 0) + 1);
  }
  console.log('Distinct event types (count):');
  for (const [k, v] of Array.from(byType.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${k || '<none>'}: ${v}`);
  }
  const combos = events.filter((e) => /combo|extended/.test(String(e.eventType || '').toLowerCase()));
  console.log(`\nFound ${combos.length} combo/extended entries:`);
  for (const e of combos) {
    console.log(`${e.t}  type=${e.eventType}  rel=${e.relative}  abs=${e.absolute}  pct=${e.percent}  dur=${e.duration}m`);
  }
  const comboUnits = combos.reduce((sum, e) => {
    const rel = Number(e.relative);
    const durM = Number(e.duration);
    if (!Number.isFinite(rel) || !Number.isFinite(durM)) return sum;
    return sum + rel * (durM / 60);
  }, 0);
  console.log(`Total combo units (relative * duration): ${comboUnits.toFixed(3)} U`);

  const switches = data
    .filter((t) => /profile switch/i.test(String(t.eventType || '')))
    .map((t) => ({
      t: t.created_at,
      profile:
        t.profile ||
        (t.profileJson && ((t.profileJson.defaultProfile || t.profileJson.name))) ||
        '',
      percent: t.percentage ?? t.percent ?? t.profilePercentage,
    }));
  console.log(`\nProfile switches (${switches.length}):`);
  for (const s of switches) {
    console.log(`${s.t}  profile=${s.profile}  percent=${s.percent}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
