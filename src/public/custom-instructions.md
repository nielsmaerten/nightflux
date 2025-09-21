This file contains a structured export of diabetes data in YAML. Help me analyze and understand the data in here.


## File structure overview

### Top level

- **meta**:
  - `schema_version`: format version number
  - `utc_generated_time`: file creation timestamp
  - `local_start`: first local date included
  - `local_end`: last local date included

- **profiles**: Basal profile definitions

- **days**: Daily data entries

- **custom_instructions** (optional): Instructions to guide AI assistants

---

### Profiles

Profiles define scheduled basal rates for reference. They show how much basal insulin would be delivered if no overrides were active.

- **id**: Unique identifier (`stable-id:name`)
- **name**: Human-readable name
- **timezone**: Timezone (IANA string)
- **blocks**:
  - `minutes_past_midnight`: Minutes since midnight (0–1439)
  - `units_hourly`: Insulin units/hour at this time

Profiles are **reference only**. Actual insulin delivered is determined by basal segments in `days.basal`.

---

### Days

Each entry represents one day of data. A day object is always self-contained.

- **date**:
  - `timezone`: IANA timezone
  - `utc_midnight`: Local midnight timestamp (Unix seconds, UTC) corresponding to that timezone
  - `local_start`: ISO timestamp rendered in the local timezone
  - `utc_end`: Exclusive upper bound timestamp at next local midnight (Unix seconds, UTC)
  - `local_end`: ISO timestamp for the exclusive upper bound in the local timezone

- **activeProfiles**: Reference list of profiles active on that day.
  - `id`: Profile id reference

  - `pct`: Percent scaling applied to profile rate (e.g. 100)

  - `utc_activation_time`: UTC timestamp when activated

  > Duplicates are possible. This section is only for reference. To calculate insulin delivery, use `basal` entries.

- **cgm**:
  - `utc_time`: UTC timestamp
  - `local_time`: Local timestamp in ISO format
  - `mgDl`: Glucose in mg/dL (only unit supported)

- **carbs**:
  - `utc_time`: UTC timestamp
  - `local_time`: Local timestamp in ISO format
  - `grams`: Grams of carbohydrate

- **bolus**:
  - `utc_time`: UTC timestamp
  - `local_time`: Local timestamp in ISO format
  - `units`: Insulin units delivered as bolus

- **basal**:
  - `utc_time`: Segment start timestamp (UTC)
  - `local_time`: Segment start timestamp rendered in the local timezone

  - `units_total`: Total insulin units delivered in this segment (informational)

  - `units_hourly`: Delivery rate in units/hour (authoritative value)

  - `duration_seconds`: Duration in seconds

  - `type`: Basal type (e.g. `baseline`, `temp-absolute`)

  > Basal segments never overlap. They fully override profile rates. Totals should be calculated using `units_hourly * (duration_seconds / 3600)`. If there is a mismatch with `units_total`, alert the user.

---

## Purpose

This dataset is intended for retrospective diabetes analysis:

- Identify glucose trends
- Correlate meals, insulin doses, and basal adjustments
- Support reporting or visualization for therapy optimization

---

## How to use

When the user asks questions about their diabetes data:

1. Parse and query this file in a code execution environment.
2. Use the schema definitions above to locate relevant data.
3. For insulin delivery, use `basal.units_hourly` (with `duration_seconds`) and `bolus.units` fields.
4. For carb intake, sum `carbs.grams` per day.
5. For glucose trends, read `cgm.mgDl` over time.
6. Provide accurate answers grounded in the data.
7. When useful, generate visualizations (e.g. charts of glucose, insulin, carbs).

---

## Clarifications

1. **Day boundaries**: Each day object is fully self-contained. No entries spill over into other days.
2. **Missing data**: If gaps are detected (e.g. in CGM readings), the agent must not fill them automatically. It should notify the user, propose possible ways to handle the gaps, and wait for confirmation.
3. **Basal authority**: `units_hourly` with `duration_seconds` is authoritative. `units_total` is informational only. If there is a mismatch, notify the user.
4. **Timezones**: All timestamps (`utc_time`, `utc_midnight`, `utc_activation_time`) are Unix seconds in UTC. `date.utc_midnight` marks local midnight of that day for the given timezone.
5. **Schema reference**: `$schema` is informational and does not need to be validated against.

---

If you've read & understood these instructions, you can now suggest a few questions the user might want to ask you.
For example:

- Summarize my last 30 days.
- Create an AGP chart.
- Help me find patterns in my data.
