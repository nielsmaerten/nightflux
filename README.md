# Nightflux

Analyze your Nightscout data with the help of AI.

Nightflux produces an AI-optimized, self-contained report of your Nightscout history. 
Share the report with an AI like ChatGPT*, and it will answer your questions, spot trends & analyze patterns for you.

\* Model recommendation: _"GPT-5 Thinking"_  _(September 2025)_

## Quick start

- Visit https://nightflux.niels.me
- Enter your Nightscout URL & token
- Select a date range
- Download your AI-ready report

## CLI Usage

Install or run via npx (Node 18.18+):

```bash
# Using npx from the registry after publish
npx github:nielsmaerten:nightflux-core https://my-nightscout.com?token=abc123 [options]

# Or, install for easy access:
npm i -g github:nielsmaerten:nightflux-core
# Then:
npx nightflux-core [url] [options]
```

### Options

| Option | Shortcut | Description | Example |
| --- | ---: | --- | --- |
| url (positional) | — | Nightscout base URL including readonly token as query param (required) | https://my.ns.example?token=TOKEN |
| --start <date> | -s | Start date (inclusive) in YYYY-MM-DD | --start 2025-08-10 |
| --end <date> | -e | End date (inclusive) in YYYY-MM-DD | --end 2025-09-10 |
| --output <file> | -o | Write export to file (defaults to `dateStart-dateEnd.yaml`) | -o export.yaml |
| --format <type> | -f | Output format: json or yaml (defaults) | --format json |
| --pretty | -p | Enable human readable output (json only) | --pretty |
| --verbose | -v | Enable verbose logging | -v |
| --quiet | -q | Minimal output (overrides verbose) | -q |
| --help | -h | Show help and exit | -h |
| --version | -V | Show CLI version and exit | --version |


---

## Library usage (advanced)

```ts
// Install with: 
// npm i github:nielsmaerten:nightflux-core
import { buildNightscoutExport } from 'nightflux-core';

const url = 'https://your.ns.example?token=READONLY_TOKEN';
const start = '2025-08-10';
const end = '2025-09-10';

const data = await buildNightscoutExport(url, start, end);

console.log('days:', data.days.length);
console.log('profiles:', data.profiles.length);
```

## Schema description

The function returns an object compliant with the `NightfluxReportSchema` defined in `src/domain/schema.ts`. Top‑level fields:

- meta: schema metadata
  - `schema_version`: number (currently `2`)
  - `utc_generated_time`: epoch seconds when the export was produced
  - `local_start`: local date string that seeded the export range (`YYYY-MM-DD`)
  - `local_end`: local date string that closed the export range (`YYYY-MM-DD`)
- profiles: list of basal profiles active in the timeframe
  - `id`: stable identifier in the form `${docId}:${name}` (ties a profile name to its Nightscout profile document)
  - `name`: human name of the profile (editable in Nightscout)
  - `timezone`: IANA timezone name used by this profile
  - `blocks`: basal blocks
    - `minutes_past_midnight`: minutes since local midnight when the block starts (0–1440)
    - `units_hourly`: basal rate in U/h while the block is active
- days: array of per‑day data for each calendar date in `[start..end]`
  - `date`: day metadata
    - `timezone`: IANA timezone resolved from the latest active profile
    - `utc_midnight`: epoch seconds at local midnight of the day (start boundary)
    - `local_start`: ISO string for the same instant rendered in the profile timezone
  - `activeProfiles`: profile timeline within that local day
    - `id`: stable profile id (`${docId}:${name}`) mapped based on the profile document active at the event time
    - `pct`: active profile percentage (e.g., 100 for default)
    - `utc_activation_time`: epoch seconds when this profile state becomes active
  - `cgm`: CGM readings within the day
    - `utc_time`: epoch seconds
    - `mgDl`: glucose value
  - `carbs`: carbohydrate entries
    - `utc_time`: epoch seconds
    - `grams`: grams of carbohydrate
  - `bolus`: insulin bolus entries
    - `utc_time`: epoch seconds
    - `units`: units (immediate + extended when applicable)
  - `basal`: basal segments covering the day (contiguous intervals)
    - `utc_time`: epoch seconds when the segment starts
    - `units_total`: total insulin delivered during the segment
    - `units_hourly`: segment rate in U/h
    - `duration`: duration of the segment in seconds
    - `type`: classifier label (e.g., `baseline`, `temp-absolute`, `temp-percent`, `combo-relative`, `baseline+combo`)

### Basal Calculation Policy

- Baseline: derived from profile basal blocks and profile switches (including profile percentage).
- Temp basal: absolute or percent overlays adjust the active rate for their duration.
- Extended/combo bolus: counted together with basal except when a temp basal is active with absolute rate `0` (suspend). In that case the combo contribution is excluded for the suspended interval.
- Segment totals and rates are rounded to 4 decimals.

### Day Boundaries and Timezones

- Day boundaries are computed using the profile timezone. For each date, the day spans `[local 00:00:00, next day 00:00:00)`.
- The export’s per‑entry timestamps are epoch seconds (UTC‑based instants) but the bucketing is done by local day.

## API

- `buildNightscoutExport(url: string, start: string, end: string)`
  - Produces the export described above.
  - Validates the result against `NightfluxReportSchema` before returning.
- `collectExport(url: string, start: string, end: string)`
  - Alias: same as `buildNightscoutExport`.

## Development

- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
