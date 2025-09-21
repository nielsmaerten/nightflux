import { z } from 'zod';

/**
 * Representation of essential diabetes data in a given timeframe (Type reference)
 */
export interface NightfluxReport {
  $schema?: string;
  custom_instructions?: string;
  meta: {
    schema_version: 2;
    utc_generated_time: number;
    local_start: string;
    local_end: string;
  };
  profiles: {
    id: string;
    name: string;
    timezone: string;
    blocks: { minutes_past_midnight: number; units_hourly: number }[];
  }[];
  notes?: {
    utc_time: number;
    local_time: string; // YYYY-MM-DDTHH:mm:ss in local timezone
    type: 'cgm' | 'pump' | 'user';
    text: string;
  }[];
  days: {
    date: {
      timezone: string;
      utc_midnight: number;
      local_start: string;
      utc_end: number;
      local_end: string;
    };
    activeProfiles: { id: string; pct: number; utc_activation_time: number }[];
    cgm: { utc_time: number; local_time: string; mgDl: number }[];
    carbs: { utc_time: number; local_time: string; grams: number }[];
    bolus: { utc_time: number; local_time: string; units: number }[];
    basal: {
      utc_time: number;
      local_time: string;
      units_total: number;
      units_hourly: number;
      duration_seconds: number;
      type: string;
    }[];
  }[];
}

// ---------- Subschemas (exported for isolated validation) ----------

export const MetaSchema = z
  .object({
    schema_version: z.literal(2),
    utc_generated_time: z.number().int().nonnegative(), // epoch seconds
    local_start: z.string(),
    local_end: z.string(),
  })
  .strict();

export const ProfileBlockSchema = z
  .object({
    minutes_past_midnight: z.number().int().min(0).max(1440), // minutes since midnight
    units_hourly: z.number().min(0), // insulin units per hour
  })
  .strict();

export const ProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(), // IANA timezone name
    blocks: z.array(ProfileBlockSchema).min(1),
  })
  .strict();

export const ProfilesSchema = z.array(ProfileSchema).min(1);

export const NoteSchema = z
  .object({
    utc_time: z.number().int(),
    local_time: z.string(),
    type: z.enum(['cgm', 'pump', 'user']),
    text: z.string(),
  })
  .strict();

export const DayDateSchema = z
  .object({
    timezone: z.string(),
    utc_midnight: z.number().int(),
    local_start: z.string(),
    utc_end: z.number().int(),
    local_end: z.string(),
  })
  .strict();

export const ActiveProfileSchema = z
  .object({
    id: z.string(),
    pct: z.number().min(0), // 100 means default; allow 0..∞
    utc_activation_time: z.number().int(),
  })
  .strict();

export const CgmEntrySchema = z
  .object({
    utc_time: z.number().int(),
    local_time: z.string(),
    mgDl: z.number().min(0),
  })
  .strict();

export const CarbEntrySchema = z
  .object({
    utc_time: z.number().int(),
    local_time: z.string(),
    grams: z.number().min(0),
  })
  .strict();

export const BolusEntrySchema = z
  .object({
    utc_time: z.number().int(),
    local_time: z.string(),
    units: z.number().min(0),
  })
  .strict();

export const BasalSegmentSchema = z
  .object({
    utc_time: z.number().int(),
    local_time: z.string(),
    units_total: z.number().min(0),
    units_hourly: z.number().min(0),
    duration_seconds: z.number().int().min(0), // duration in seconds
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

export const NightfluxReportSchema = z
  .object({
    $schema: z.url().optional(),
    custom_instructions: z.string().optional(),
    meta: MetaSchema,
    profiles: ProfilesSchema,
    notes: z.array(NoteSchema).optional(),
    days: z.array(DaySchema),
  })
  .strict();

// ---------- Helpers ----------

export type NightfluxReportZ = z.infer<typeof NightfluxReportSchema>;

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
  nightfluxReport: (data: unknown) => NightfluxReportSchema.safeParse(data),
};
