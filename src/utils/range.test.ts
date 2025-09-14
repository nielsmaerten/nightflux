import { describe, expect, it, vi } from 'vitest';
import { resolveRange } from './range.js';

describe('range', () => {
  it('returns the correct range when passed start & end', () => {
    const tz = 'UTC';
    const start = '2025-01-10';
    const end = '2025-01-20';
    const range = resolveRange(tz, start, end);
    expect(range).toEqual({ start, end });
  });

  it('returns the correct range when passed start & days', () => {
    const tz = 'UTC';
    const start = '2025-01-10';
    const days = 5; // inclusive => end = 2025-01-14
    const range = resolveRange(tz, start, undefined, days);
    expect(range).toEqual({ start, end: '2025-01-14' });
  });

  it('returns the correct range when passed end & days', () => {
    const tz = 'UTC';
    const end = '2025-01-20';
    const days = 5; // inclusive => start = 2025-01-16
    const range = resolveRange(tz, undefined, end, days);
    expect(range).toEqual({ start: '2025-01-16', end });
  });

  it('returns the correct range when passed start only', () => {
    const tz = 'UTC';
    // Freeze time so "yesterday" is deterministic: 2025-09-13
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-14T12:00:00Z'));
    try {
      const start = '2025-09-01';
      const range = resolveRange(tz, start);
      expect(range).toEqual({ start, end: '2025-09-13' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the correct range when passed end only', () => {
    const tz = 'UTC';
    const end = '2025-09-13';
    const range = resolveRange(tz, undefined, end);
    // 30-day inclusive range => start is 29 days before end
    expect(range).toEqual({ start: '2025-08-15', end });
  });

  it('returns the correct range when passed nothing', () => {
    const tz = 'UTC';
    // Freeze time so "yesterday" is deterministic: 2025-09-13
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-14T12:00:00Z'));
    try {
      const range = resolveRange(tz);
      expect(range).toEqual({ start: '2025-08-15', end: '2025-09-13' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws when start > end', () => {
    const tz = 'UTC';
    expect(() => resolveRange(tz, '2025-01-10', '2025-01-09')).toThrowError();
  });
});
