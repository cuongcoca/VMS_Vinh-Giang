# E2E tests (Playwright)

## Setup

```bash
npm install
npx playwright install chromium
```

## Run

```bash
# Against local dev server
npm run dev   # in a separate terminal
E2E_BASE_URL=http://localhost:3000 npm run e2e

# Against VPS (after wms.vinhgiang.com SSL is up)
E2E_BASE_URL=https://wms.vinhgiang.com npm run e2e

# Headed / UI mode (debug)
npm run e2e:ui

# Open HTML report
npm run e2e:report
```

## Environment

| Var | Default | Purpose |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | Target server (the suite handles the `/wms` basePath) |
| `E2E_ADMIN_EMAIL` | `admin@vinhgiang.vn` | Login identity (must exist + be ADMIN role) |
| `E2E_ADMIN_PASSWORD` | `Aa@123456` | Login password (matches seed) |

## Specs

| File | Coverage |
|---|---|
| `auth.spec.ts` | Login form, invalid creds, JWT payload, token storage |
| `pallets.spec.ts` | M03 list page + API CRUD + UC-PAL-03 scanner modal (3 tabs) |
| `inbound.spec.ts` | M04 list page + PHN code format + pallet code sequence |
| `master-data.spec.ts` | M02 suppliers CRUD + product-groups + units API |
| `rbac.spec.ts` | Admin reaches `/system/mail`, unauth API returns 401/403 |
| `mobile/scanner.spec.ts` | Pixel 5 viewport — UC-PAL-03 fallback when camera denied |

## CI

Configured for `process.env.CI`:
- `retries: 2`, `forbidOnly: true`, `reporter: github`.

Tests are serialized (`workers: 1`, `fullyParallel: false`) because they share
a single Postgres — running them in parallel causes pallet-code sequence
collisions on `PLT-YYMMDD-NNN`.
