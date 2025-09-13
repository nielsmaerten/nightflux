/**
 * Nightscout treatment record as returned by /api/v1/treatments.
 * Only fields used by our clients are modeled here.
 */
export type NsTreatment = {
  eventType?: string;
  profile?: string | { name?: string } | null;
  profileName?: string;
  profileSelected?: string;
  percent?: number;
  percentage?: number;
  profilePercentage?: number;
  mills?: number; // ms since epoch
  date?: number; // ms since epoch
  created_at?: string; // ISO timestamp
  // Other fields may exist but are not modeled here
  [key: string]: unknown;
};
