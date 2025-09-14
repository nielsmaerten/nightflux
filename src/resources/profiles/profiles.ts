import Nightscout from '../../clients/nightscout.js';
import { ProfilesSchema } from '../../domain/schema.js';
import { validateWithSchema, validateTimeRangeStrict } from '../../utils/common-utils.js';

// Types for Nightscout profile API response (subset we use)
type NsBasalEntry = { time: string; timeAsSeconds: number; value: number };
type NsProfileParams = {
  dia: number;
  basal: NsBasalEntry[];
  units: string;
  timezone?: string;
  // other fields (carbratio, sens, targets) are present but not needed here
};
type NsProfileDoc = {
  _id: string;
  date?: number; // ms since epoch
  startDate?: string; // ISO
  defaultProfile?: string;
  store: Record<string, NsProfileParams>;
};

export type ProfileBlock = { m: number; iu_h: number };
export type Profile = { id: string; name: string; tz: string; blocks: ProfileBlock[] };

export default class ProfileClient {
  constructor(private ns: Nightscout) {}

  /**
   * Fetch profile definitions active in the timeframe.
   *
   * This returns the static profile definitions (name, timezone, basal blocks)
   * that were active between the given epoch seconds, flattened to the
   * ProfilesSchema shape. It does NOT describe when a profile was switched on;
   * for the time-ordered activation timeline, use
   * ActiveProfileClient.getActiveProfileTimelineBetween.
   */
  async getProfileDefinitionsBetween(start: number, end: number): Promise<Profile[]> {
    validateTimeRangeStrict(start, end);

    const docs = await this.ns.query<NsProfileDoc[]>(
      `/api/v1/profile.json?start=${start}&end=${end}`,
    );

    // Transform Nightscout profile documents to flat list of profiles with basal blocks
    const profiles: Profile[] = [];
    for (const doc of docs || []) {
      for (const [name, params] of Object.entries(doc.store || {})) {
        const blocks: ProfileBlock[] = (params.basal || [])
          .slice()
          .sort((entryA, entryB) => entryA.timeAsSeconds - entryB.timeAsSeconds)
          .map((basalEntry) => ({
            m: Math.max(0, Math.min(1440, Math.floor(basalEntry.timeAsSeconds / 60))),
            iu_h: basalEntry.value,
          }));

        // Ignore empty block sets to satisfy schema min(1)
        if (blocks.length === 0) continue;

        // Use Nightscout provided profile timezone if present, otherwise default to 'UTC'
        const tz = (params as NsProfileParams).timezone || 'UTC';

        profiles.push({ id: `${doc._id}:${name}`, name, tz, blocks });
      }
    }

    // Validate against ProfilesSchema to ensure we return the correct shape
    return validateWithSchema(profiles, ProfilesSchema, 'profiles');
  }

  async fetchLatestProfile(): Promise<Profile> {
    const now = Date.now();
    const _1week = 7 * 24 * 3600 * 1000;
    const profiles = await this.getProfileDefinitionsBetween(now - _1week, now);
    if (!profiles || profiles.length === 0) throw new Error('No active profiles found');
    return profiles[0];
  }
}
