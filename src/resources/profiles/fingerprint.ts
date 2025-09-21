import { createHash } from 'node:crypto';
import type { Profile, ProfileBlock } from './profiles.js';

function round(n: number, dp = 4): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

/**
 * Create a stable content fingerprint for a list of basal blocks.
 * - Sorts by minutes
 * - Rounds rates to 4 decimals for stability
 * - Hashes canonical JSON for deterministic output
 */
export function fingerprintBlocks(blocks: ProfileBlock[]): string {
  const canonical = (blocks || [])
    .map((block) => ({
      minutes_past_midnight: Math.max(
        0,
        Math.min(1440, Math.floor(block.minutes_past_midnight)),
      ),
      units_hourly: round(block.units_hourly),
    }))
    .sort((a, b) => a.minutes_past_midnight - b.minutes_past_midnight);
  const json = JSON.stringify(canonical);
  const hash = createHash('sha256').update(json).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Fingerprint a profile (based on its basal blocks only).
 */
export function fingerprintProfile(profile: Profile): string {
  return fingerprintBlocks(profile.blocks);
}
