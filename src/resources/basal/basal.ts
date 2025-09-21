import Nightscout from '../../clients/nightscout.js';
import { addDays, addHours, parse, isValid, format } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// -------- Types kept local to avoid imports from the reference implementation --------
interface NightscoutTreatment {
  eventType?: string;
  created_at?: string;
  _created_at?: string;
  date?: number | string;
  mills?: number;
  durationInMilliseconds?: number | string;
  duration?: number | string;
  durationMinutes?: number | string;
  absolute?: number;
  rate?: number;
  percent?: number;
  relative?: number;
  profile?: string;
  profileJson?: unknown;
  _id?: string;
  [key: string]: unknown;
}

interface ProfileBasalStep {
  minutes?: number;
  timeAsSeconds?: number;
  start?: string;
  time?: string;
  value: number | string;
}

interface ProfileLike {
  basal?: ProfileBasalStep[];
  [key: string]: unknown;
}

interface NormalizedProfileStore {
  defaultProfile: string;
  store: Record<string, ProfileLike>;
}

interface BaselineSegment {
  start: number; // ms
  end: number; // ms
  rate: number; // U/h (base profile rate before profile percentage)
  pct: number; // multiplier (1.0 == 100%) from active profile percentage
  source: 'baseline';
}

interface TempBasalOverlay {
  start: number;
  end: number;
  absolute: number | null;
  percent: number | null;
  _id?: string;
}

interface ComboBolusOverlay {
  start: number;
  end: number;
  relative: number; // U/h addition
  _id?: string;
}

interface Overlays {
  temps: TempBasalOverlay[];
  combos: ComboBolusOverlay[];
}

export default class BasalClient {
  constructor(private ns: Nightscout) {}

  /**
   * Compute basal segments for a specific local day (YYYY-MM-DD).
   */
  async computeBasalDay(date: string, tz: string) {
    // Validate date (YYYY-MM-DD) using date-fns and timezone via Intl
    if (!date) throw new Error('date is required (YYYY-MM-DD)');
    const dateStr = String(date);
    const parsed = parse(dateStr, 'yyyy-MM-dd', new Date(0));
    if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== dateStr) {
      throw new Error('Invalid date format; expected YYYY-MM-DD');
    }

    try {
      // Throws RangeError if not a valid IANA time zone
      new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(parsed);
    } catch {
      throw new Error(`Invalid time zone: ${tz}`);
    }
    const window = computeWindow(date, tz);
    if (!window) throw new Error(`Failed to parse date ${date} in zone ${tz}`);

    // Fetch and normalize profile
    const profileJson = await this.ns.query('/api/v1/profile.json');
    const profileDoc = normalizeProfile(profileJson);
    if (!profileDoc) throw new Error('No usable profile store found');
    const { defaultProfile, store } = profileDoc;

    // Fetch treatments in the timeframe [windowStart, windowEnd)
    const { windowStart, windowEnd, dayStart, dayEnd } = window;
    const treatments = await this.fetchTreatmentsPaged(
      toIsoString(windowStart),
      toIsoString(windowEnd),
    );

    // Extract overlays and profile switches
    const profileSwitches = treatments.filter((t) => /profile switch/i.test(t.eventType || ''));

    // Mitigation: also fetch the most recent profile switch at or before dayStart
    const latestSwitch = await this.fetchLatestProfileSwitchAtOrBefore(toIsoString(dayStart));
    if (latestSwitch) {
      const latestMs = toMs(latestSwitch);
      // Only add if it's not already present (dedupe by start time)
      const already = profileSwitches.some((t) => toMs(t) === latestMs);
      if (!already) profileSwitches.push(latestSwitch);
    }
    const overlays = parseTreatmentsForOverlays(treatments);

    // Build baseline (profile) segments for the day
    const baseline = buildBaseline(
      tz,
      dayStart.getTime(),
      dayEnd.getTime(),
      store,
      defaultProfile,
      profileSwitches,
    );
    if (baseline.length === 0)
      throw new Error('Baseline schedule is empty for the selected day; cannot compute basal.');

    // Assemble final segments with overlays applied
    const segments = assembleTimeline(tz, dayStart.getTime(), dayEnd.getTime(), baseline, overlays);
    if (!segments.length) throw new Error('No segments were produced.');

    const data = {
      date,
      tz,
      segments: segments.map((s) => ({
        start: s.start,
        end: s.end,
        start_humanized: humanizeMs(s.start, tz),
        stop_humanized: humanizeMs(s.end, tz),
        rate_U_per_h: s.rate_U_per_h,
        total_U: s.total_U,
        notes: s.notes,
      })),
    } as const;

    const meta = {
      counts: {
        treatments: treatments.length,
        baselineSegments: baseline.length,
        segments: segments.length,
      },
      sum: segments.reduce((acc, s) => acc + s.total_U, 0),
      window: {
        start: toIsoString(windowStart),
        end: toIsoString(windowEnd),
      },
    } as const;

    return { data, meta };
  }

  // -------- Internal helpers (client) --------
  private async fetchTreatmentsPaged(
    startISO: string,
    endISO: string,
  ): Promise<NightscoutTreatment[]> {
    const limit = 1000;
    let skip = 0;
    const out: NightscoutTreatment[] = [];
    // Nightscout supports paging via skip+count; sort ascending for stable merge
    for (;;) {
      const batch = (await this.ns.query('/api/v1/treatments.json', {
        params: {
          'find[created_at][$gte]': startISO,
          'find[created_at][$lt]': endISO,
          count: limit,
          skip,
          sort$desc: false,
        },
      })) as NightscoutTreatment[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      out.push(...batch);
      if (batch.length < limit) break;
      skip += batch.length;
      if (skip > 10000) break;
    }
    out.sort((a, b) => toMs(a) - toMs(b));
    return out;
  }

  /**
   * Find the most recent Profile Switch treatment at or before the provided ISO timestamp.
   * Returns the raw treatment object when found; otherwise null.
   */
  private async fetchLatestProfileSwitchAtOrBefore(
    beforeISO: string,
  ): Promise<NightscoutTreatment | null> {
    const limit = 1000;
    let skip = 0;
    const beforeMs = Date.parse(beforeISO);
    // Page descending in time using created_at to minimize data scanned
    for (;;) {
      const batch = (await this.ns.query('/api/v1/treatments.json', {
        params: {
          'find[eventType]': 'Profile Switch',
          'find[created_at][$lte]': beforeISO,
          count: limit,
          skip,
          sort$desc: true,
        },
      })) as NightscoutTreatment[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      // Because we requested descending order, the first matching item is the most recent
      for (const t of batch) {
        if (!/profile switch/i.test(t.eventType || '')) continue;
        const ms = toMs(t);
        if (!Number.isFinite(ms) || (Number.isFinite(beforeMs) && ms > beforeMs)) continue;
        return t;
      }
      if (batch.length < limit) break;
      skip += batch.length;
      if (skip > 10_000) break;
    }
    return null;
  }
}

// -------------------- Core logic (ported) --------------------
/**
 * Compute a set of Date boundaries for a given calendar date in a specified time zone.
 *
 * @returns An object containing:
 *  - dayStart: Date   -> midnight (00:00:00) of `dateStr` in the provided zone.
 *  - dayEnd: Date     -> midnight (00:00:00) of the day after `dateStr`.
 *  - windowStart: Date-> 24 hours before `dayStart` (i.e. midnight of the previous day).
 *  - windowEnd: Date  -> 1 hour after `dayEnd` (i.e. 01:00 of the next day).
 *
 * The returned window therefore spans from the previous day's 00:00 to the following day's 01:00.
 *
 * If the constructed `dayStart` is invalid (NaN), the function returns `null`.
 */
function computeWindow(
  dateStr: string,
  zone: string,
): {
  dayStart: Date;
  dayEnd: Date;
  windowStart: Date;
  windowEnd: Date;
} | null {
  const localDayStart = `${dateStr}T00:00:00`;
  const dayStart = fromZonedTime(localDayStart, zone);
  if (Number.isNaN(dayStart.getTime())) return null;
  const dayEnd = addDays(dayStart, 1);
  const windowStart = addHours(dayStart, -24);
  const windowEnd = addHours(dayEnd, 1);
  return { dayStart, dayEnd, windowStart, windowEnd };
}

function toMs(obj: Partial<NightscoutTreatment> | null | undefined): number {
  if (!obj) return 0;
  if (typeof obj.mills === 'number') return obj.mills;
  if (obj.date !== undefined) {
    const n = Number(obj.date);
    if (!Number.isNaN(n)) return n;
  }
  if (obj.created_at) return Date.parse(obj.created_at);
  if (obj._created_at) return Date.parse(obj._created_at);
  return 0;
}

function normalizeProfile(json: unknown): NormalizedProfileStore | null {
  const doc = Array.isArray(json)
    ? (json[0] as Record<string, unknown>)
    : ((json || {}) as Record<string, unknown>);
  if (!doc) return null;
  const defaultProfile = (doc as any).defaultProfile || (doc as any).default || 'Default';
  const store = ((doc as any).store || (doc as any)[defaultProfile] || doc) as Record<
    string,
    ProfileLike
  >;
  if (!store || typeof store !== 'object') return null;
  return { defaultProfile, store };
}

function profileBasalSchedule(
  profileObj: ProfileLike | undefined | null,
): { minutes: number; rate: number }[] {
  const basal = Array.isArray(profileObj?.basal) ? profileObj!.basal! : [];
  const steps = basal
    .map((b) => {
      let minutes: number;
      if (typeof b.minutes === 'number') minutes = b.minutes;
      else if (typeof b.timeAsSeconds === 'number') minutes = Math.floor(b.timeAsSeconds / 60);
      else minutes = hmToMinutes(b.start || b.time);
      return { minutes, rate: Number(b.value) };
    })
    .filter((s) => Number.isFinite(s.minutes) && Number.isFinite(s.rate));
  steps.sort((a, b) => a.minutes - b.minutes);
  return steps;
}

function hmToMinutes(hm: string | undefined): number {
  if (!hm || typeof hm !== 'string') return NaN;
  const [hStr, mStr] = hm.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
}

function addMinutesFrom(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function segmentsFromSchedule(
  zone: string,
  interval: { start: number; end: number },
  steps: { minutes: number; rate: number }[],
): BaselineSegment[] {
  const { start, end } = interval;
  const startDate = new Date(start);
  const startLocalStr = formatInTimeZone(startDate, zone, "yyyy-MM-dd'T'00:00:00");
  const dayStartUtc = fromZonedTime(startLocalStr, zone);

  const segments: BaselineSegment[] = [];
  for (let i = 0; i < steps.length; i++) {
    const startMinutes = steps[i].minutes;
    const endMinutes = i + 1 < steps.length ? steps[i + 1].minutes : 24 * 60;
    const segStart = addMinutesFrom(dayStartUtc, startMinutes).getTime();
    const segEnd = addMinutesFrom(dayStartUtc, endMinutes).getTime();
    const a = Math.max(segStart, start);
    const b = Math.min(segEnd, end);
    if (a < b) {
      segments.push({ start: a, end: b, rate: steps[i].rate, pct: 1, source: 'baseline' });
    }
  }
  return segments;
}

function buildBaseline(
  zone: string,
  dayStartMs: number,
  dayEndMs: number,
  store: Record<string, ProfileLike>,
  defaultProfileName: string,
  profileSwitches: NightscoutTreatment[],
): BaselineSegment[] {
  const intervals: { start: number; end: number; profile: string; pct: number }[] = [];
  const switches = (profileSwitches || [])
    .map((ev) => ({
      t: toMs(ev),
      profile:
        ev.profile || (ev.profileJson as any)?.defaultProfile || (ev.profileJson as any)?.name,
      profileJson: ev.profileJson,
      // Many servers use `percentage`; some use `percent` or `profilePercentage`
      percentage: (typeof (ev as any).percentage === 'number' &&
      Number.isFinite((ev as any).percentage)
        ? (ev as any).percentage
        : typeof (ev as any).percent === 'number' && Number.isFinite((ev as any).percent)
          ? (ev as any).percent
          : typeof (ev as any).profilePercentage === 'number' &&
              Number.isFinite((ev as any).profilePercentage)
            ? (ev as any).profilePercentage
            : 100) as number,
    }))
    .filter((x) => Number.isFinite(x.t) && x.t <= dayEndMs && typeof x.profile === 'string')
    .sort((a, b) => a.t - b.t);

  // Inject ad-hoc profile JSONs into store when present (Nightscout behavior)
  for (const sw of switches) {
    if (sw.profileJson && !store[sw.profile as string]) {
      try {
        const json =
          typeof sw.profileJson === 'string' ? JSON.parse(sw.profileJson) : sw.profileJson;
        if (json && typeof json === 'object') {
          const profileObj = json as ProfileLike;
          // Do not apply percentage here; percentage is carried in intervals.
          (store as any)[sw.profile as string] = profileObj as ProfileLike;
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }

  // Determine the active profile at dayStart: last switch at or before dayStart
  let activeProfile = defaultProfileName;
  let activePct = 100;
  for (const sw of switches) {
    if (sw.t <= dayStartMs && store[sw.profile as string]) {
      activeProfile = sw.profile as string;
      activePct = typeof sw.percentage === 'number' ? Math.max(0, sw.percentage) : 100;
    }
  }

  let cursor = dayStartMs;
  for (const sw of switches) {
    if (sw.t < dayStartMs) continue;
    if (sw.t >= dayEndMs) break;
    if (cursor < sw.t)
      intervals.push({ start: cursor, end: sw.t, profile: activeProfile, pct: activePct });
    if (store[sw.profile as string]) {
      activeProfile = sw.profile as string;
      activePct = typeof sw.percentage === 'number' ? Math.max(0, sw.percentage) : 100;
    }
    cursor = sw.t;
  }
  if (cursor < dayEndMs)
    intervals.push({ start: cursor, end: dayEndMs, profile: activeProfile, pct: activePct });

  const baseline: BaselineSegment[] = [];
  for (const it of intervals) {
    const steps = profileBasalSchedule(store[it.profile] || {});
    const segs = segmentsFromSchedule(zone, it, steps);
    const multiplier = Math.max(0, Number(it.pct) || 0) / 100;
    for (const s of segs) {
      s.pct = multiplier;
      baseline.push(s);
    }
  }
  baseline.sort((a, b) => a.start - b.start || a.end - b.end);
  return baseline;
}

function parseTreatmentsForOverlays(treatments: NightscoutTreatment[]): Overlays {
  const tempsByStart = new Map<number, TempBasalOverlay>();
  const combos: ComboBolusOverlay[] = [];

  for (const t of treatments) {
    const type = (t.eventType || '').toLowerCase();
    const start = toMs(t);
    if (!Number.isFinite(start) || start === 0) continue;

    // Temp basal events
    if (
      type.includes('temp') &&
      (type.includes('basal') || type.includes('target') || type.includes('rate'))
    ) {
      // Nightscout variants: duration, durationMinutes, durationInMilliseconds
      let durationMs = Number(t.durationInMilliseconds);
      if (!Number.isFinite(durationMs)) {
        const minutes = Number(t.durationMinutes ?? t.duration);
        if (Number.isFinite(minutes)) durationMs = Math.round(minutes * 60_000);
      }
      if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
      const end = start + durationMs;

      // Absolute or percent
      const absolute = Number.isFinite(t.absolute)
        ? (t.absolute as number)
        : Number.isFinite(t.rate)
          ? (t.rate as number)
          : null;
      const percent = Number.isFinite(t.percent) ? (t.percent as number) : null;

      const key = start;
      const prev = tempsByStart.get(key);
      if (!prev) tempsByStart.set(key, { start, end, absolute, percent, _id: t._id });
      else {
        // Prefer absolute overrides over percent when duplicates exist
        const merged: TempBasalOverlay = {
          start: Math.min(prev.start, start),
          end: Math.max(prev.end, end),
          absolute: prev.absolute ?? absolute,
          percent: prev.absolute != null ? prev.percent : (percent ?? prev.percent),
          _id: prev._id || t._id,
        };
        tempsByStart.set(key, merged);
      }
      continue;
    }

    // Combo/extended bolus modeled as relative add-on (U/h)
    if (type.includes('combo') || type.includes('extended')) {
      let durationMs = Number(t.durationInMilliseconds);
      if (!Number.isFinite(durationMs)) {
        const minutes = Number(t.durationMinutes ?? t.duration);
        if (Number.isFinite(minutes)) durationMs = Math.round(minutes * 60_000);
      }
      const relative = Number(t.relative);
      if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
      if (!Number.isFinite(relative) || relative === 0) continue;
      const end = start + durationMs;
      combos.push({ start, end, relative, _id: t._id });
    }
  }

  const temps = Array.from(tempsByStart.values()).sort((a, b) => a.start - b.start);
  // Snap close-but-gapped temps to avoid micro gaps (<= 65s)
  for (let i = 0; i < temps.length - 1; i++) {
    const gap = temps[i + 1].start - temps[i].end;
    if (gap > 0 && gap <= 65_000) temps[i].end = temps[i + 1].start;
  }

  combos.sort((a, b) => a.start - b.start);
  return { temps, combos };
}

function assembleTimeline(
  zone: string,
  dayStartMs: number,
  dayEndMs: number,
  baselineSegs: BaselineSegment[],
  overlays: Overlays,
) {
  const boundaries = new Set<number>([dayStartMs, dayEndMs]);
  for (const s of baselineSegs) {
    boundaries.add(s.start);
    boundaries.add(s.end);
  }
  for (const t of overlays.temps) {
    const ta = Math.max(dayStartMs, t.start);
    const tb = Math.min(dayEndMs, t.end);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta < tb) {
      boundaries.add(ta);
      boundaries.add(tb);
    }
  }
  for (const c of overlays.combos) {
    const ta = Math.max(dayStartMs, c.start);
    const tb = Math.min(dayEndMs, c.end);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta < tb) {
      boundaries.add(ta);
      boundaries.add(tb);
    }
  }

  const times = Array.from(boundaries)
    .filter((x) => Number.isFinite(x) && x >= dayStartMs && x <= dayEndMs)
    .sort((a, b) => a - b);

  function baselineRateAt(ms: number): number {
    for (let i = baselineSegs.length - 1; i >= 0; i--) {
      const seg = baselineSegs[i];
      if (ms >= seg.start && ms < seg.end) return seg.rate * (seg.pct ?? 1);
    }
    for (const seg of baselineSegs) {
      if (ms < seg.start) return seg.rate * (seg.pct ?? 1);
    }
    const last = baselineSegs[baselineSegs.length - 1];
    return last ? last.rate * (last.pct ?? 1) : 0;
  }

  function activeTempAt(ms: number): TempBasalOverlay | null {
    let candidate: TempBasalOverlay | null = null;
    for (const t of overlays.temps) {
      if (ms >= t.start && ms < t.end) candidate = t;
    }
    return candidate;
  }

  function comboRelativeAt(ms: number): number {
    let rel = 0;
    for (const c of overlays.combos) {
      if (ms >= c.start && ms < c.end) rel = c.relative;
      if (c.start > ms) break;
    }
    return rel;
  }

  const segments: {
    start: number;
    end: number;
    rate_U_per_h: number;
    total_U: number;
    notes: string;
  }[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const a = times[i];
    const b = times[i + 1];
    if (a >= b) continue;
    let rate = baselineRateAt(a);
    let note = 'baseline';
    const temp = activeTempAt(a);
    if (temp) {
      if (Number.isFinite(temp.absolute)) {
        rate = temp.absolute as number;
        note = 'temp-absolute';
      } else if (Number.isFinite(temp.percent)) {
        const multiplier = (100 + (temp.percent as number)) / 100;
        rate = Math.max(0, baselineRateAt(a) * multiplier);
        note = 'temp-percent';
      } else {
        note = 'temp-unknown';
      }
    }
    // Include combo relative unless a temp basal explicitly sets absolute rate to 0 (suspend).
    // - If temp is active and absolute === 0 -> exclude combo (avoid counting during suspend).
    // - Otherwise include combo alongside baseline/temp.
    const comboRel =
      temp && Number.isFinite(temp.absolute) && (temp.absolute as number) === 0
        ? 0
        : comboRelativeAt(a);
    if (comboRel) {
      rate = Math.max(0, rate + comboRel);
      note = note === 'baseline' ? 'combo-relative' : `${note}+combo`;
    }
    const total = rate * ((b - a) / 3_600_000);
    segments.push({
      start: a,
      end: b,
      rate_U_per_h: round(rate),
      total_U: round(total),
      notes: note,
    });
  }

  const merged: typeof segments = [];
  for (const s of segments) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.rate_U_per_h === s.rate_U_per_h &&
      last.notes === s.notes &&
      last.end === s.start
    ) {
      last.end = s.end;
      last.total_U = round(last.total_U + s.total_U);
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function humanizeMs(ms: number, zone: string): string {
  return formatInTimeZone(new Date(ms), zone, 'yyyy-LL-dd HH:mm:ss');
}
