import { z } from 'zod';

/**
 * Representation of essential diabetes data in a given timeframe (Type reference)
 */
export interface DiabetesData {
  meta: {
    schema_version: number;
    generated_at: number; // epoch seconds
  };
  // There should be at least 1 profile, and a profile should have at least 1 block
  profiles: {
    id: string;
    name: string;
    tz: string;
    // m: when the block starts, in minutes since midnight
    // iu_h: insulin units per hour that get delivered while this block is active
    blocks: { m: number; iu_h: number }[];
  }[];
  notes?: {
    t: number; // epoch seconds
    type: 'cgm' | 'pump' | 'user';
    text: string;
  }[];
  // all dates in the given timeframe
  days: {
    // t: epoch seconds that represent midnight (start of the day)
    date: { timezone: string; t: number };

    // during the day, multiple profiles can be active
    // id: reference to the active profile
    // pct: a profile runs at 100% by default, but can be adjusted to be more/less aggressive
    // start: the epoch seconds when the profile becomes active
    // a day must have at least 1 activeProfile
    activeProfiles: { id: string; pct: number; start: number }[];

    // cgm: continuous glucose monitor readings
    cgm: { t: number; mgDl: number }[];
    // carbs: carbohydrate intake
    carbs: { t: number; g: number }[];
    // bolus: insulin bolus events
    bolus: { t: number; iu: number }[];
    // basal: segments of basal insulin delivery
    // t: epoch seconds when this basal segment becomes active
    // iu_sum: total insulin units delivered during this basal segment
    // iu_h: insulin units per hour during this basal segment
    // d: duration of the basal segment in seconds
    basal: { t: number; iu_sum: number; iu_h: number; d: number; type: string }[];
  }[];
}

// ---------- Subschemas (exported for isolated validation) ----------

export const MetaSchema = z
  .object({
    schema_version: z.number(),
    generated_at: z.number().int().nonnegative(), // epoch seconds
  })
  .strict();

export const ProfileBlockSchema = z
  .object({
    m: z.number().int().min(0).max(1440), // minutes since midnight
    iu_h: z.number().min(0), // insulin units per hour
  })
  .strict();

export const ProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    tz: z.string(), // IANA timezone name
    blocks: z.array(ProfileBlockSchema).min(1),
  })
  .strict();

export const ProfilesSchema = z.array(ProfileSchema).min(1);

export const NoteSchema = z
  .object({
    t: z.number().int(),
    type: z.enum(['cgm', 'pump', 'user']),
    text: z.string(),
  })
  .strict();

export const DayDateSchema = z
  .object({
    timezone: z.string(),
    t: z.number().int(),
  })
  .strict();

export const ActiveProfileSchema = z
  .object({
    id: z.string(),
    pct: z.number().min(0), // 100 means default; allow 0..∞
    start: z.number().int(),
  })
  .strict();

export const CgmEntrySchema = z
  .object({
    t: z.number().int(),
    mgDl: z.number().min(0),
  })
  .strict();

export const CarbEntrySchema = z
  .object({
    t: z.number().int(),
    g: z.number().min(0),
  })
  .strict();

export const BolusEntrySchema = z
  .object({
    t: z.number().int(),
    iu: z.number().min(0),
  })
  .strict();

export const BasalSegmentSchema = z
  .object({
    t: z.number().int(),
    iu_sum: z.number().min(0),
    iu_h: z.number().min(0),
    d: z.number().int().min(0), // duration in seconds
    type: z.string(),
  })
  .strict();

export const CgmArraySchema = z.array(CgmEntrySchema);
export const CarbsArraySchema = z.array(CarbEntrySchema);
export const BolusArraySchema = z.array(BolusEntrySchema);
export const BasalArraySchema = z.array(BasalSegmentSchema);

export const DaySchema = z
  .object({
    date: DayDateSchema,
    activeProfiles: z.array(ActiveProfileSchema).min(1),
    cgm: CgmArraySchema,
    carbs: CarbsArraySchema,
    bolus: BolusArraySchema,
    basal: BasalArraySchema,
  })
  .strict();

// ---------- Root schema ----------

export const DiabetesDataSchema = z
  .object({
    meta: MetaSchema,
    profiles: ProfilesSchema,
    notes: z.array(NoteSchema).optional(),
    days: z.array(DaySchema),
  })
  .strict();

// ---------- Helpers ----------

export type DiabetesDataZ = z.infer<typeof DiabetesDataSchema>;

export const validate = {
  meta: (data: unknown) => MetaSchema.safeParse(data),
  profileBlock: (data: unknown) => ProfileBlockSchema.safeParse(data),
  profile: (data: unknown) => ProfileSchema.safeParse(data),
  profiles: (data: unknown) => ProfilesSchema.safeParse(data),
  note: (data: unknown) => NoteSchema.safeParse(data),
  dayDate: (data: unknown) => DayDateSchema.safeParse(data),
  activeProfile: (data: unknown) => ActiveProfileSchema.safeParse(data),
  cgmEntry: (data: unknown) => CgmEntrySchema.safeParse(data),
  cgmArray: (data: unknown) => CgmArraySchema.safeParse(data),
  carbEntry: (data: unknown) => CarbEntrySchema.safeParse(data),
  carbsArray: (data: unknown) => CarbsArraySchema.safeParse(data),
  bolusEntry: (data: unknown) => BolusEntrySchema.safeParse(data),
  bolusArray: (data: unknown) => BolusArraySchema.safeParse(data),
  basalSegment: (data: unknown) => BasalSegmentSchema.safeParse(data),
  basalArray: (data: unknown) => BasalArraySchema.safeParse(data),
  day: (data: unknown) => DaySchema.safeParse(data),
  diabetesData: (data: unknown) => DiabetesDataSchema.safeParse(data),
};
