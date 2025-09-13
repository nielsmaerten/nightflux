# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/`. Build output goes to `dist/`.
- Key modules: `src/nightscout.ts` (Nightscout API client), `src/schema.ts` (Zod schemas + helpers).
- Tests are colocated with code as `*.test.ts` (e.g., `src/nightscout.test.ts`).
- Config: `tsconfig.json`, `vitest.config.ts`, Prettier in `.prettierrc.json`. Node >= 18.18.

## Build, Test, and Development Commands
- `npm run build`: TypeScript compile to `dist/`.
- `npm run typecheck`: Strict TS checks without emitting.
- `npm test`: Start a single test run with Vitest.
- `npm run test:watch`: Watch mode tests during development.
- `npm run format`: Prettier write formatting for `src/`.
- `npm run format:check`: Validate formatting.
- `npm run clean`: Remove `dist/`.

## Coding Style & Naming Conventions
- Formatting: Prettier (semi: true, singleQuote: true, trailingComma: all, printWidth: 100).
- Indentation: 2 spaces; files use `.ts` and ESM (`type: module`).
- Naming: files lower-case with words joined by hyphen or plain (e.g., `schema.ts`, `nightscout.ts`); tests `*.test.ts`.
- Types: enable strict TS; prefer explicit types on exports and public APIs.
- Use full variable names. 1-2 letter names are forbidden.
- Do not run formatting or linting scripts unless asked by the user. 

## Testing Guidelines
- Framework: Vitest (Node environment). Coverage via V8 reporters.
- Test files: `src/**/*.test.ts`. Use descriptive `describe/it` names.
- Test use external calls to a read Nightscout instance. 
- A readonly token is provided by the env or .env file.
- Do not use mocking: test against the dedicated test server
- Run locally: `npm test` or `npm run test:watch` for TDD.

## Security & Configuration Tips
- Never commit secrets; `.env` is git-ignored. Example: `NIGHTSCOUT_URL=https://your.ns.example?token=YOUR_TOKEN`.
- The client auto-injects `token` as a query param; base URL should be the Nightscout root, not `/api`.

## Nightscout Test Setup
- Tests hit a live Nightscout instance using a readonly token.
- Ensure `NIGHTSCOUT_URL` is set in the environment to the server URL with the token query param.
- A helper script `./scripts/run-tests.sh` exports proxy/cert env vars, verifies the token works, and then runs `npm test`.
- Environment defaults used by the script:
  - `HTTP_PROXY` / `HTTPS_PROXY`: `http://proxy:8080`
  - `NODE_EXTRA_CA_CERTS`: `/usr/local/share/ca-certificates/envoy-mitmproxy-ca-cert.crt`
- To verify connectivity manually:
  ```bash
  curl -fsSL "$NIGHTSCOUT_URL/api/v1/status"
  ```
- When the curl check succeeds, run tests via `npm test` or the helper script.
