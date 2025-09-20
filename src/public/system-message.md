AI Agents, please read this message carefully: This file contains a structured diabetes data export in YAML/JSON.

## File Reference

### Top level

* **meta**:

  * `schema_version`: format version number
  * `generated_at`: file creation timestamp (Unix seconds, UTC)

* **profiles**: Basal profile definitions

* **days**: Daily data entries

---

### Profiles

Profiles define scheduled basal rates for reference. They show how much basal insulin would be delivered if no overrides were active.

* **id**: Unique identifier (`stable-id:name`)
* **name**: Human-readable name
* **tz**: Timezone (IANA string)
* **blocks**:

  * `m`: Minutes since midnight (0–1439)
  * `iu_h`: Insulin units/hour at this time

Profiles are **reference only**. Actual insulin delivered is determined by basal segments in `days.basal`.

---

### Days

Each entry represents one day of data. A day object is always self-contained.

* **date**:

  * `timezone`: IANA timezone
  * `t`: Local midnight timestamp (Unix seconds, UTC) corresponding to that timezone

* **activeProfiles**: Reference list of profiles active on that day.

  * `id`: Profile id reference

  * `pct`: Percent scaling applied to profile rate (e.g. 100)

  * `start`: UTC timestamp when activated

  > Duplicates are possible. This section is only for reference. To calculate insulin delivery, use `basal` entries.

* **cgm**:

  * `t`: UTC timestamp
  * `mgDl`: Glucose in mg/dL (only unit supported)

* **carbs**:

  * `t`: UTC timestamp
  * `g`: Grams of carbohydrate

* **bolus**:

  * `t`: UTC timestamp
  * `iu`: Insulin units delivered as bolus

* **basal**:

  * `t`: Segment start timestamp (UTC)

  * `iu_sum`: Total insulin units delivered in this segment (informational)

  * `iu_h`: Delivery rate in units/hour (authoritative value)

  * `d`: Duration in minutes

  * `type`: Basal type (e.g. `baseline`, `temp-absolute`)

  > Basal segments never overlap. They fully override profile rates. Totals should be calculated using `iu_h * d/60`. If there is a mismatch with `iu_sum`, alert the user.

---

## Purpose

This dataset is intended for retrospective diabetes analysis:

* Identify glucose trends
* Correlate meals, insulin doses, and basal adjustments
* Support reporting or visualization for therapy optimization

---

## How to use

When the user asks questions about their diabetes data:

1. Parse and query this file in a code execution environment.
2. Use the schema definitions above to locate relevant data.
3. For insulin delivery, use `basal.iu_h` (with `d`) and `bolus.iu` fields.
4. For carb intake, sum `carbs.g` per day.
5. For glucose trends, read `cgm.mgDl` over time.
6. Provide accurate answers grounded in the data.
7. When useful, generate visualizations (e.g. charts of glucose, insulin, carbs).

---

## Clarifications

1. **Day boundaries**: Each day object is fully self-contained. No entries spill over into other days.
2. **Missing data**: If gaps are detected (e.g. in CGM readings), the agent must not fill them automatically. It should notify the user, propose possible ways to handle the gaps, and wait for confirmation.
3. **Basal authority**: `iu_h` with `d` is authoritative. `iu_sum` is informational only. If there is a mismatch, notify the user.
4. **Timezones**: All timestamps (`t`) are Unix seconds in UTC. `date.t` marks local midnight of that day for the given timezone.
5. **Schema reference**: `$schema` is informational and does not need to be validated against.

---

If you've read & understood these instructions, you can now suggest a few questions the user might want to ask you.
For example: 
- Summarize my last 30 days.
- Create an AGP chart.
- Help me find patterns in my data.