# nightflux-core

An unopinionated, TypeScript-first core library for exporting diabetes data from Nightscout. It composes specialized clients (CGM, carbs, bolus, profiles, basal) into a single, schema‑validated export object suitable for downstream analytics and integrations.

## Install

Install via npm (Node 18.18+):

```
npm install nightflux-core
```

## Quick Start

```
import { buildNightscoutExport } from 'nightflux-core';

const url = 'https://your.ns.example?token=READONLY_TOKEN';
const start = '2025-08-10';
const end = '2025-09-10';

const data = await buildNightscoutExport(url, start, end);

console.log('days:', data.days.length);
console.log('profiles:', data.profiles.length);
```

Notes:
- The `url` must include a `token` query parameter (readonly token recommended).
- Dates are local calendar dates (`YYYY-MM-DD`); the library determines the timezone from the active profile.

## CLI Usage

Install or run via npx (Node 18.18+):

```
# Using npx from the registry after publish
npx nightflux-core [url] [options]

# Or install locally and use the bin
npm install nightflux-core
npx nightflux-core [url] -d 30 --pretty
```

Options:

- `-u, --url <url>`: Nightscout base URL with `?token=...`
- `-s, --start <YYYY-MM-DD>`: Start date
- `-e, --end <YYYY-MM-DD>`: End date
- `-d, --days <n>`: Number of days (derives the other side)
- `-o, --out <file>`: Output file path (default `ns-report-START-END.json`)
- `--pretty`: Pretty-print JSON (2 spaces)
- `-h, --help`: Show help
- `-V, --version`: Show version

Examples:

```
npx nightflux-core https://ns.example?token=... -s 2025-09-01 -e 2025-09-07
npx nightflux-core -u https://ns.example?token=... -d 30 --pretty -o out/report.json
```

## What It Returns

The function returns an object compliant with the `DiabetesDataSchema` defined in `src/domain/schema.ts`. Top‑level fields:

- meta: schema metadata
  - `schema_version`: number (currently `1`)
  - `generated_at`: epoch seconds when the export was produced
- profiles: list of basal profiles active in the timeframe
  - `id`: stable identifier in the form `${docId}:${name}` (ties a profile name to its Nightscout profile document)
  - `name`: human name of the profile (editable in Nightscout)
  - `tz`: IANA timezone name used by this profile
  - `blocks`: basal blocks
    - `m`: minutes since local midnight when the block starts (0–1440)
    - `iu_h`: basal rate in U/h while the block is active
- days: array of per‑day data for each calendar date in `[start..end]`
  - `date`: day metadata
    - `timezone`: IANA timezone resolved from the latest active profile
    - `t`: epoch seconds at local midnight of the day (start boundary)
  - `activeProfiles`: profile timeline within that local day
    - `id`: stable profile id (`${docId}:${name}`) mapped based on the profile document active at the event time
    - `pct`: active profile percentage (e.g., 100 for default)
    - `start`: epoch seconds when this profile state becomes active
  - `cgm`: CGM readings within the day
    - `t`: epoch seconds
    - `mgDl`: glucose value
  - `carbs`: carbohydrate entries
    - `t`: epoch seconds
    - `g`: grams
  - `bolus`: insulin bolus entries
    - `t`: epoch seconds
    - `iu`: units (immediate + extended when applicable)
  - `basal`: basal segments covering the day (contiguous intervals)
    - `t`: epoch seconds when the segment starts
    - `iu_sum`: total insulin delivered during the segment
    - `iu_h`: segment rate in U/h
    - `d`: duration of the segment in seconds
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
  - Validates the result against `DiabetesDataSchema` before returning.
- `collectExport(url: string, start: string, end: string)`
  - Alias: same as `buildNightscoutExport`.

## Error Handling

- Throws on invalid date formats, start > end, or invalid timezone.
- Throws if Nightscout access fails or if the final object fails schema validation.

## Development

- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
