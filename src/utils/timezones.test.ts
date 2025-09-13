import { describe, expect, it } from 'vitest';
import { toUtcRange } from './timezones';

describe('toUtcRange (timezone helper)', () => {
  it('computes exact 24h for UTC timezone single day', () => {
    const { start, end } = toUtcRange('2025-08-24', '2025-08-24', 'UTC');
    expect(typeof start).toBe('number');
    expect(typeof end).toBe('number');
    expect(end - start).toBe(24 * 3600);
  });

  it('handles DST spring forward (short 23h day) in Europe/Brussels', () => {
    // In 2025, DST begins on 2025-03-30 in Europe/Brussels
    const { start, end } = toUtcRange('2025-03-30', '2025-03-30', 'Europe/Brussels');
    expect(end - start).toBe(23 * 3600);
  });

  it('handles DST fall back (long 25h day) in Europe/Brussels', () => {
    // In 2025, DST ends on 2025-10-26 in Europe/Brussels
    const { start, end } = toUtcRange('2025-10-26', '2025-10-26', 'Europe/Brussels');
    expect(end - start).toBe(25 * 3600);
  });

  it('throws on invalid timezone', () => {
    expect(() => toUtcRange('2025-08-24', '2025-08-24', 'Not/AZone')).toThrow(
      /Invalid IANA timezone/i,
    );
  });

  it('throws on invalid date format', () => {
    expect(() => toUtcRange('2025/08/24', '2025-08-24', 'UTC')).toThrow(/format/i);
    expect(() => toUtcRange('2025-08-24', '24-08-2025', 'UTC')).toThrow(/format/i);
  });

  it('throws when startDate > endDate', () => {
    expect(() => toUtcRange('2025-08-25', '2025-08-24', 'UTC')).toThrow(/must be <=/i);
  });
});
