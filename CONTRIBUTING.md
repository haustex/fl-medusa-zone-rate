# Contributing

Thank you for helping! Bug reports, fixes, new province lists and translations are welcome. For larger changes
please open an issue first, so we can agree on the approach.

## Setup

Node.js 20.19+ or 22.12+, Docker (for the end-to-end Postgres).

```bash
npm ci
npm run build
```

## Checks

Every pull request runs these in CI, against Medusa 2.19.0 and 2.22.2:

```bash
npm run lint
npm run typecheck        # the plugin and the Admin extensions
npm run test:unit
npm run build
```

To try another Medusa release locally: `node scripts/use-medusa.mjs 2.22.2` (not saved; `npm ci` goes back).

## End-to-end tests

`integration-tests/e2e.mjs` creates a fresh database, migrates, seeds two regions, three calculated shipping options
and two products, starts Medusa on port 9500 and checks prices, refusals and the Admin routes through the HTTP API.

```bash
docker run -d --name zr-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=zr_spike \
  -p 127.0.0.1:55434:5432 postgres:17-alpine
npm run build && node integration-tests/e2e.mjs
```

The E2E script waits up to 60 s for the container (over TCP: the image's first, socket-only init server restarts). Another
container name: `ZR_PG_CONTAINER=<name> node integration-tests/e2e.mjs`.

Every Medusa command goes through `scripts/guard.mjs`, which refuses any database other than
`127.0.0.1:55434`, any Redis other than `127.0.0.1:56381` and HTTP ports below 9500.

## Database changes

Change a model in `src/modules/zoneRate/models`, then generate the migration against the throwaway database:

```bash
export DATABASE_URL=postgres://postgres:spike@127.0.0.1:55434/zr_spike REDIS_URL=redis://127.0.0.1:56381
npm run db:generate
```

## Style

- Money and weights are integers (rupiah, grams); no floats in price paths.
- User-facing text in English and Indonesian (`src/lib/messages.ts`, `src/admin/i18n/json`).
- Small commits with clear messages; update CHANGELOG.md under "Unreleased".
