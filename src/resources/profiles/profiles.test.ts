import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import Nightscout from '../../clients/nightscout.js';
import ProfileClient from './profiles';
import { ProfilesSchema } from '../../domain/schema';

describe('Nightscout profiles (integration)', () => {
  it('fetches profiles active in the last 30 days', async () => {
    const ns = new Nightscout();
    const nowSec = Math.floor(Date.now() / 1000);
    const thirtyDaysSec = 30 * 24 * 3600;
    const start = nowSec - thirtyDaysSec;
    const end = nowSec + 60; // small cushion
    const profileClient = new ProfileClient(ns);

    const profiles = await profileClient.getProfileDefinitionsBetween(start, end);

    // Validate via schema
    const parsed = ProfilesSchema.safeParse(profiles);
    expect(parsed.success).toBe(true);
    expect(profiles.length).toBeGreaterThan(0);

    // Basic block validation:
    // Each profile should have >0 blocks
    // The iu of all blocks combined should be > 0
    for (const profile of profiles) {
      expect(profile.blocks.length).toBeGreaterThan(0);
      expect(
        profile.blocks.reduce((sum: number, block: any) => sum + (block.iu_h || 0), 0),
      ).toBeGreaterThan(0);
    }
  });
});
