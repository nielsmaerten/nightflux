import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRange } from './range.js';

describe('resolveRange', () => {
  const timezone = 'UTC';
  const anchorDate = new Date('2025-10-01T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(anchorDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns provided start and end when both supplied', () => {
    const result = resolveRange(timezone, '2025-09-20', '2025-09-30');
    expect(result).toEqual({ start: '2025-09-20', end: '2025-09-30' });
  });

  it('defaults to 30 day window ending yesterday when no explicit inputs provided', () => {
    const result = resolveRange(timezone);
    expect(result).toEqual({ start: '2025-08-31', end: '2025-09-30' });
  });

  it('uses days as an offset when only --days is provided', () => {
    const result = resolveRange(timezone, undefined, undefined, 10);
    expect(result).toEqual({ start: '2025-09-20', end: '2025-09-30' });
  });

  it('computes end from start when days are provided', () => {
    const result = resolveRange(timezone, '2025-03-20', undefined, 5);
    expect(result).toEqual({ start: '2025-03-20', end: '2025-03-25' });
  });

  it('computes start from end when days are provided', () => {
    const result = resolveRange(timezone, undefined, '2025-09-20', 10);
    expect(result).toEqual({ start: '2025-09-10', end: '2025-09-20' });
  });

  it('throws when start, end, and days are all provided', () => {
    expect(() => resolveRange(timezone, '2025-09-01', '2025-09-10', 5)).toThrow();
  });
});
