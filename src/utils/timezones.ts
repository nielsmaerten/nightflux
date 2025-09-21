import { addDays, isValid, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export function assertValidTimezone(tz: string): void {
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new Error(`Invalid IANA timezone: '${tz}'.`);
  }
}

/**
 * Convert a local date range in a specific IANA timezone into UTC epoch seconds.
 *
 * Contract:
 * - Inputs: startDate and endDate as 'yyyy-mm-dd' strings, tz as IANA timezone (e.g., 'Europe/Brussels').
 * - Output: { start, end } where
 *   - start = UTC epoch seconds at 00:00:00 of startDate in tz
 *   - end   = UTC epoch seconds at 00:00:00 of the day AFTER endDate in tz (exclusive upper bound)
 * - Throws on invalid date strings, invalid timezone, or startDate > endDate.
 */
export function toUtcRange(
  startDate: string,
  endDate: string,
  tz: string,
): { start: number; end: number } {
  // Basic format guard
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate)) {
    throw new Error(`Invalid startDate format: '${startDate}'. Expected 'yyyy-mm-dd'.`);
  }
  if (!dateRe.test(endDate)) {
    throw new Error(`Invalid endDate format: '${endDate}'. Expected 'yyyy-mm-dd'.`);
  }

  // Validate timezone via Intl
  assertValidTimezone(tz);

  // Parse dates (as calendar dates without time)
  const startParsed = parse(startDate, 'yyyy-MM-dd', new Date());
  const endParsed = parse(endDate, 'yyyy-MM-dd', new Date());
  if (!isValid(startParsed)) {
    throw new Error(`Invalid startDate value: '${startDate}'.`);
  }
  if (!isValid(endParsed)) {
    throw new Error(`Invalid endDate value: '${endDate}'.`);
  }

  // Ensure ordering
  if (startParsed.getTime() > endParsed.getTime()) {
    throw new Error('startDate must be <= endDate.');
  }

  // Build local-midnight strings to avoid ambiguity, then interpret in tz
  const startLocalStr = `${startDate} 00:00:00`;
  const endPlusOne = addDays(endParsed, 1);
  const endPlusOneStr = `${endPlusOne.getFullYear()}-${String(endPlusOne.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(endPlusOne.getDate()).padStart(2, '0')} 00:00:00`;

  const startUtc = fromZonedTime(startLocalStr, tz);
  const endUtc = fromZonedTime(endPlusOneStr, tz);

  return {
    start: Math.floor(startUtc.getTime() / 1000),
    end: Math.floor(endUtc.getTime() / 1000),
  };
}
