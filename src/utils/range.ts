import { addDays, format, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Nightscout from '../clients/nightscout.js';
import ProfileClient from '../resources/profiles/profiles.js';

const DEFAULT_DAYS = 30;

export function parseDateStrict(s: string): Date {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(s)) throw new Error(`Invalid date format: ${s}. Expected YYYY-MM-DD.`);
  const p = parse(s, 'yyyy-MM-dd', new Date(0));
  if (format(p, 'yyyy-MM-dd') !== s) throw new Error(`Invalid date: ${s}.`);
  return p;
}

export async function resolveTimezone(url: string): Promise<string> {
  const ns = new Nightscout(url);
  const profileClient = new ProfileClient(ns);
  const latest = await profileClient.fetchLatestProfile();
  return latest.tz || 'UTC';
}

export function resolveRange(
  tz: string,
  start?: string,
  end?: string,
  days?: number,
): { start: string; end: string } {
  const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  const yday = format(addDays(parse(today, 'yyyy-MM-dd', new Date(0)), -1), 'yyyy-MM-dd');

  const hasStart = typeof start === 'string';
  const hasEnd = typeof end === 'string';
  const hasDays = typeof days === 'number';

  if (hasStart && hasEnd && hasDays) {
    throw new Error('Specify at most two of start, end, and days.');
  }

  let s = start;
  let e = end;

  if (hasStart && hasEnd) {
    // take provided values
  } else if (hasStart && hasDays) {
    const sp = parseDateStrict(start!);
    e = format(addDays(sp, days!), 'yyyy-MM-dd');
  } else if (hasEnd && hasDays) {
    const ep = parseDateStrict(end!);
    s = format(addDays(ep, -days!), 'yyyy-MM-dd');
  } else if (hasDays) {
    e = yday;
    const ep = parseDateStrict(e);
    s = format(addDays(ep, -days!), 'yyyy-MM-dd');
  } else if (hasStart && !hasEnd) {
    e = yday;
  } else if (hasEnd && !hasStart) {
    const ep = parseDateStrict(end!);
    s = format(addDays(ep, -DEFAULT_DAYS), 'yyyy-MM-dd');
  } else {
    e = yday;
    const ep = parseDateStrict(e);
    s = format(addDays(ep, -DEFAULT_DAYS), 'yyyy-MM-dd');
  }

  const sp = parseDateStrict(s!);
  const ep = parseDateStrict(e!);
  if (sp.getTime() > ep.getTime()) throw new Error('start must be <= end.');

  return { start: s!, end: e! };
}
