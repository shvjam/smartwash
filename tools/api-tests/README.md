# API tests

Two harnesses that drive the running API the way the panel does and then check what it left
behind. Between them every route the API exposes is called at least once.

| file | what it covers |
|---|---|
| `sweep.mjs` | the shop floor — orders, bays, the queue, money, staff, the till, bookings, support, access control |
| `audit.mjs` | everything the sweep never touches — the cron jobs, the catalogue, user administration, campaigns, loyalty and the wallet, onboarding, SMS on both sides, billing, the platform's own operations, plan gating, and the public endpoints a stranger can reach |

They assert on state rather than on status codes wherever that is possible: that a deactivated
service leaves the active list, that a suspended tenant can be brought back, that a changed
password works and the old one does not. A request that returns 200 and leaves a bay held or a
queue misnumbered is the kind of bug that has actually cost us, and a status-code check would
not have caught any of them.

## Checking that the panel and the API still agree

Three more files compare the two codebases without running anything. They catch the drift a
behavioural test cannot see until somebody presses the wrong button:

| file | what it compares |
|---|---|
| `contract.mjs` | every route the backend exposes against every route the frontend calls — a call to a route that does not exist fails the run |
| `dtos.mjs` | the fields of every C# DTO against the TypeScript type of the same name — a field the screen reads and the server never sends is a blank cell or a `NaN` |
| `wrappers.mjs` | API wrappers that no screen calls — each one is a feature the API has and the panel does not offer |

```bash
node tools/api-tests/contract.mjs && node tools/api-tests/dtos.mjs && node tools/api-tests/wrappers.mjs
```

The frontend's own types are checked with `pnpm typecheck` in `frontend/` — the Vite build
does not type-check, so a screen reading a field that does not exist compiles and ships.

## Running them

Point them at a running API and run them in this order — the sweep creates the orders and
customers that some of the audit's detail reads need.

```bash
SW_API=http://localhost:5080 node tools/api-tests/sweep.mjs
```

```bash
SW_API=http://localhost:5080 node tools/api-tests/audit.mjs
```

`SW_API` defaults to `http://localhost:5080`. Both exit non-zero if anything failed, so they
can gate a deploy.

They expect the seeded demo carwash (`demo-carwash` / `demo@appsmartwash.com`) and the
platform owner, with the passwords the API was started with — the defaults here are the local
development ones, `Demo@1234` and `Owner@12345`. The cron checks send the `X-Cron-Secret`
header and expect it to be `local-cron`.

## Run them against an empty database too

Anything that only happens at seeding time — the plans and their SMS policy, the permission
map, the first boot's migrations — is only ever proved on a database that starts from
nothing, which is the state a new deployment is in. Create an empty database, start the API
against it with `Database__MigrateOnStartup=true` and `Seed__RunOnStartup=true`, and run both
files against that too. Several defects have been found this way and in no other way.

## They write to the database they run against

Both create real orders, customers, users and tenants, and they do not fully clean up after
themselves: branches and bays have no delete, so each run leaves a few behind. Run them
against a development or staging database, never against production.
