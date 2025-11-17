This file contains a structured export of diabetes data. Follow these instructions:

Use the data in this file to assist with tasks such as:
- Identify glucose trends
- Correlate meals, insulin doses, and basal adjustments
- Reporting or visualization for therapy optimization

At a high level, when asked a question regarding the data:
- Parse and query this file in a code execution environment
- Use the schema definitions below as a guide to locate relevant data
- Provide accurate answers grounded in the data
- When useful, generate visualizations (e.g. charts of glucose, insulin, carbs)

Extra notes:
- Day objects are self-contained: the entries do not spill over into other days.
- If you detect missing data (e.g. in CGM readings), confirm with the user before attempting to fill the gaps.

Schema definition:
- meta:
  - schema_version: format version number
  - utc_generated_time: file creation timestamp
  - local_start: earliest local time entry in the dataset
  - local_end: last entry in the dataset
- profiles[]: (baseline basal profiles for reference; when no basal segment exists, fall back to this)
  - id: Unique identifier (stable-id:name)
  - name: Human-readable name
  - timezone: Timezone (IANA string)
  - blocks:
    - minutes_past_midnight: 0–1439, indicates when the block starts
    - units_hourly: Insulin rate during this block
- days[]:
  - date:
    - timezone: IANA timezone
    - utc_start: Unix timestamp of day start
    - utc_end: Unix timestamp of day end
    - local_start: ISO timestamp rendered in the local timezone
    - local_end: ISO timestamp for the exclusive upper bound in the local timezone
  - activeProfiles[]: (profile that were active on this day)
    - id: Profile id reference
    - pct: Percent scaling applied to profile rate (e.g. 100)
    - utc_activation_time: Unix timestamp when activated
  - cgm[]: (continuous glucose readings)
    - utc_time: Unix timestamp of this reading
    - local_time: Local timestamp in ISO format
    - mgDl: Glucose value, always in mg/dL
  - carbs[]:
    - utc_time: Unix timestamp
    - local_time: Local timestamp in ISO format
    - grams: Grams of carbohydrate intake
  - bolus[]:
    - utc_time: Unix timestamp
    - local_time: Local timestamp in ISO format
    - units: Insulin units delivered as bolus
  - basal[]: (continuous basal insulin delivery)
    - utc_time: Segment start timestamp (UTC)
    - local_time: Segment start timestamp rendered in the local timezone
    - units_total: Total insulin units delivered in this segment (authoritative value)
    - units_hourly: Delivery rate in units/hour (informational)
    - duration_seconds: Duration in seconds
    - type: Basal type (informational)

This concludes the custom instructions.
