# Nightflux

Analyze your Nightscout data with the help of AI.

Nightflux produces an AI-optimized, self-contained report of your Nightscout history. 
Share the report with an AI like ChatGPT and ask it to follow the instructions included in the file.

Now, the AI will be able to answer questions like:
- Help me discover patterns in my glucose data
- Create a chart of my deviations during the day
- When am I most likely to go low?
- ...

_Note: For best results, use a high-reasoning model like GPT-5 Thinking_

## Quick start

- Visit https://nightflux.niels.me
- Enter your Nightscout URL & token
- Select a date range
- Download your AI-ready report

## Running locally

Install or run via npx (Node 18.18+):

```bash
# Direct run with npx
npx github:nielsmaerten/nightflux <url> [options]

# Install for quick access
npm i -g github:nielsmaerten/nightflux
nightflux <url> [options]

# Examples:
## Export last 30 days to YAML (default)
nightflux https://your-nightscout.site?token=TOKEN

## Remember your Nightscout URL for next time
nightflux --remember https://your-nightscout.site?token=TOKEN
nightflux # URL auto-filled from previous run
# Forget the remembered URL
nightflux --remember

## Export a specific date range to JSON
nightflux https://your-nightscout.site?token=TOKEN --start 2024-05-01 --end 2024-05-31 --format json

## Show help
nightflux --help
```

### Options

| Option | Shortcut | Description | Example |
| --- | ---: | --- | --- |
| url (positional) | — | Nightscout base URL including readonly token as query param (required) | https://your-nightscout.site?token=TOKEN |
| --start <date> | -s | Start date (inclusive) in YYYY-MM-DD | --start 2025-08-10 |
| --end <date> | -e | End date (inclusive) in YYYY-MM-DD | --end 2025-09-10 |
| --output <file> | -o | Write export to file (defaults to `dateStart-dateEnd.yaml`) | -o export.yaml |
| --format <type> | -f | Output format: json or yaml (defaults) | --format json |
| --pretty | -p | Enable human readable output (json only) | --pretty |
| --remember | -r | Store the Nightscout URL (or clear it when no URL is provided) | --remember |
| --quiet | -q | Minimal output (overrides verbose) | -q |
| --help | -h | Show help and exit | -h |
| --version | -V | Show CLI version and exit | --version |
