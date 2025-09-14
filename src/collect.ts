import Nightscout from './clients/nightscout.js';
import CgmClient from './resources/cgm/cgm.js';
import CarbsClient from './resources/carbs/carbs.js';
import BolusClient from './resources/bolus/bolus.js';
import ProfileClient from './resources/profiles/profiles.js';
import ActiveProfileClient from './resources/profiles/activeProfileClient.js';
import BasalClient from './resources/basal/basal.js';
import { toUtcRange } from './utils/timezones.js';
import { DiabetesDataSchema, type DiabetesData } from './domain/schema.js';
import { parse, isValid, addDays, format } from 'date-fns';

/**
 * Produce a full export of diabetes data from a Nightscout instance.
 *
 * Params:
 * - url: Nightscout base URL with `token` query param (e.g., https://ns.example?token=...)
 * - start, end: inclusive local dates as 'YYYY-MM-DD'
 *
 * Returns a JSON object validated by DiabetesDataSchema.
 */
export async function collectExport(url: string, start: string, end: string): Promise<DiabetesData> {
  // Validate date strings
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(start)) throw new Error(`Invalid start date format: ${start}`);
  if (!dateRe.test(end)) throw new Error(`Invalid end date format: ${end}`);
  const startParsed = parse(start, 'yyyy-MM-dd', new Date(0));
  const endParsed = parse(end, 'yyyy-MM-dd', new Date(0));
  if (!isValid(startParsed) || !isValid(endParsed)) throw new Error('Invalid date values');
  if (format(startParsed, 'yyyy-MM-dd') !== start) throw new Error(`Invalid start date: ${start}`);
  if (format(endParsed, 'yyyy-MM-dd') !== end) throw new Error(`Invalid end date: ${end}`);
  if (startParsed.getTime() > endParsed.getTime()) throw new Error('start must be <= end');

  // Clients
  const ns = new Nightscout(url);

  // Fail fast if the instance/token is unreachable or invalid
  await ns.testConnection();
  const cgmClient = new CgmClient(ns);
  const carbsClient = new CarbsClient(ns);
  const bolusClient = new BolusClient(ns);
  const profileClient = new ProfileClient(ns);
  const activeProfileClient = new ActiveProfileClient(ns);
  const basalClient = new BasalClient(ns);

  // Determine timezone from latest profile
  const latestProfile = await profileClient.fetchLatestProfile();
  const tz = latestProfile.tz;

  // Global UTC range for [start..end] inclusive in the resolved timezone
  const { start: rangeStart, end: rangeEnd } = toUtcRange(start, end, tz);

  // Profiles: use stable ids from ProfileClient (docId:name). Do not remap to names.
  const profileDefs = await profileClient.getProfileDefinitionsBetween(rangeStart, rangeEnd);
  const profiles = profileDefs;

  // Active profile timeline across entire range (ids are names; we'll map to stable ids later)
  const activeTimeline = await activeProfileClient.getActiveProfileTimelineBetween(
    rangeStart,
    rangeEnd,
  );

  // Fetch raw profile docs to build a time-aware mapping from profile switch names -> stable ids
  type NsBasalEntry = { timeAsSeconds?: number; value?: number };
  type NsProfileDoc = {
    _id: string;
    date?: number;
    startDate?: string;
    store?: Record<string, { basal?: NsBasalEntry[] }>;
  };
  const rawDocs = await ns.query<NsProfileDoc[]>(`/api/v1/profile.json?start=${rangeStart}&end=${rangeEnd}`);
  const normalizeName = (s: string) => s.replace(/\s*\(\s*\d+\s*%\s*\)\s*$/u, '').trim();
  const startsByName = new Map<string, Array<{ startMs: number; docId: string; docName: string }>>();
  for (const doc of rawDocs || []) {
    const startMs =
      typeof doc.date === 'number'
        ? doc.date
        : typeof doc.startDate === 'string'
          ? Date.parse(doc.startDate)
          : 0;
    const store = doc.store || {};
    for (const [docName, params] of Object.entries(store)) {
      const blocks = Array.isArray(params?.basal) ? params!.basal! : [];
      if (!blocks || blocks.length === 0) continue; // ignore empty profiles
      const key = normalizeName(docName);
      const arr = startsByName.get(key) || [];
      arr.push({ startMs, docId: doc._id, docName });
      startsByName.set(key, arr);
    }
  }
  for (const arr of startsByName.values()) arr.sort((a, b) => a.startMs - b.startMs);

  // Fetch CGM, carbs, bolus once and bucket by day later
  const [cgmAll, carbsAll, bolusAll] = await Promise.all([
    cgmClient.getBetween(rangeStart, rangeEnd),
    carbsClient.getBetween(rangeStart, rangeEnd),
    bolusClient.getBetween(rangeStart, rangeEnd),
  ]);

  // Build list of day strings (inclusive)
  const daysList: string[] = [];
  for (let d = startParsed; d.getTime() <= endParsed.getTime(); d = addDays(d, 1)) {
    daysList.push(format(d, 'yyyy-MM-dd'));
  }

  // Helper to compute per-day active profiles from global timeline
  function sliceActiveProfiles(dayStart: number, dayEnd: number) {
    // Find the most recent state <= dayStart
    let current = activeTimeline[0];
    for (const it of activeTimeline) {
      if (it.start <= dayStart) current = it;
      else break;
    }
    const entries: { id: string; pct: number; start: number }[] = [];
    const mapToStableId = (name: string, atSec: number): string => {
      const key = normalizeName(name || '');
      const arr = startsByName.get(key) || [];
      const atMs = Math.floor(atSec * 1000);
      let chosen: { startMs: number; docId: string; docName: string } | undefined;
      for (const it of arr) {
        if (it.startMs <= atMs) chosen = it; // keep latest <= atMs
        else break;
      }
      if (!chosen) chosen = arr[arr.length - 1]; // fallback to latest in range
      return chosen ? `${chosen.docId}:${chosen.docName}` : key || 'unknown';
    };

    if (current)
      entries.push({ id: mapToStableId(current.id, dayStart), pct: current.pct, start: dayStart });
    for (const it of activeTimeline) {
      if (it.start >= dayEnd) break;
      if (it.start >= dayStart && it.start < dayEnd)
        entries.push({ id: mapToStableId(it.id, it.start), pct: it.pct, start: it.start });
    }
    if (entries.length === 0)
      entries.push({ id: mapToStableId(current?.id || 'unknown', dayStart), pct: current?.pct ?? 100, start: dayStart });
    return entries;
  }

  // Assemble per-day objects
  const days = [] as DiabetesData['days'];
  for (const dayStr of daysList) {
    const { start: dayStart, end: dayEnd } = toUtcRange(dayStr, dayStr, tz);

    // Bucket signal and treatment entries
    const cgm = cgmAll.filter((e) => e.t >= dayStart && e.t < dayEnd);
    const carbs = carbsAll.filter((e) => e.t >= dayStart && e.t < dayEnd);
    const bolus = bolusAll.filter((e) => e.t >= dayStart && e.t < dayEnd);

    // Basal segments for the day
    const basalDay = await basalClient.computeBasalDay(dayStr, tz);
    const basal = basalDay.data.segments.map((s) => ({
      t: Math.floor(s.start / 1000),
      iu_sum: s.total_U,
      iu_h: s.rate_U_per_h,
      d: Math.floor((s.end - s.start) / 1000),
      type: s.notes,
    }));

    // Active profile timeline within the day
    const activeProfiles = sliceActiveProfiles(dayStart, dayEnd);

    days.push({
      date: { timezone: tz, t: dayStart },
      activeProfiles,
      cgm,
      carbs,
      bolus,
      basal,
    });
  }

  const exportObj: DiabetesData = {
    meta: { schema_version: 1, generated_at: Math.floor(Date.now() / 1000) },
    profiles,
    days,
  };

  // Validate before returning
  const parsed = DiabetesDataSchema.safeParse(exportObj);
  if (!parsed.success) {
    throw new Error(`Export failed schema validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

export default collectExport;
