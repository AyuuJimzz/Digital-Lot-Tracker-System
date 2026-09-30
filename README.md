<div align="center">

<img src="front-end/src/assets/image/golden-dragon-logo.png" alt="Golden Dragon Estate logo" width="96" />

# Golden Dragon Estate Platform

**Digital Lot Tracker & Subdivision Estate Management System**

From paper subdivision plans and disconnected spreadsheets to a map-centered, auditable lot-inventory workflow.

![React 18](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![Express 5](https://img.shields.io/badge/Express-5-303030?logo=express&logoColor=white)
![MySQL 8](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-2D%20Maps-199900?logo=leaflet&logoColor=white)
![Aiven TLS](https://img.shields.io/badge/Aiven-Verified%20TLS-5A67D8)
![CI](https://img.shields.io/badge/GitHub%20Actions-CI-2088FF?logo=githubactions&logoColor=white)

[Live application](https://goldendragonestate.onrender.com) · [Production runbook](docs/production_rollout_runbook.md) · [Report an issue](https://github.com/goldendragonestate/Digital-Lot-Tracker-System/issues/new)

</div>

> [!NOTE]
> The live link is an application entry point, not a claim that every release gate has passed. Repository issue reporting may require project access.

## Why this exists

Subdivision operations often split the same facts across printed plans, spreadsheets, reservation forms, and sales records. That makes it difficult to tell which lot is available, who reserved it, which agent owns the client relationship, and whether a reported sale date is supported by evidence.

| Operational problem | Platform response |
| --- | --- |
| A lot can be offered twice when paper and spreadsheet records diverge. | A shared inventory model and transactional status changes with row-level locking protect reservation and sale transitions. |
| A blueprint is hard to relate to actual geography. | A calibrated plan overlay and geographic lot geometry connect plan labels to the interactive estate map. |
| Parks and facilities inflate saleable inventory. | Explicit non-saleable classification keeps those parcels out of saleable totals and blocks reservation or sale through the API. |
| Legacy records can distort current-month reporting. | Date provenance distinguishes verified sales from undated or synthetic backfills; unverified dates stay out of dated sales charts. |
| Sales and staff changes need traceability. | Transaction, activity, account, and sale-date audit records provide reviewable history. |

The platform serves two primary workspaces: **administrators** oversee properties, inventory, staff, analytics, sale-date corrections, and plan alignment; **employees** manage assigned reservations, clients, lot details, and sales records.

## Capabilities

### Spatial inventory and blueprint alignment

- Inspect lots on a Leaflet 2D map with vector lot geometry, searchable labels, metadata, zoom/pan navigation, and satellite, streets, or hybrid tile layers.
- Upload a subdivision plan as **PDF, PNG, JPG, or WebP**, then align and scale it against geographic coordinates before tracing or importing lot candidates. Plans exported from CAD software can be used in these formats; native DWG/DXF import is **not** implemented.
- View Available, Pending, and Sold inventory while keeping non-saleable areas separate from the saleable count. Unmapped lots may exist without polygon coordinates.

> [!IMPORTANT]
> Map imagery is loaded from third-party tile endpoints configured in the frontend. Review the provider's licensing, attribution, and usage terms before a commercial rollout. OpenStreetMap Nominatim is used for geocoding; the current map tiles are not OpenStreetMap tiles.

### Sales integrity and account controls

- Lot-status updates use backend authorization, transaction boundaries, and a database row lock. Sold lots cannot be changed directly to Pending; reversals follow an administrator-controlled path.
- Verified sale dates are separated from unverified legacy dates. Reversal and cancellation records are excluded from completed-sale analytics, and undated sold lots are not placed in a monthly sales-count chart as if their dates were known.
- Administrators can manage employee access and inspect activity; employees work within their assigned records. The sales data records payment **method** such as Cash or Installment, but this is not a full installment-ledger/accounting module.
- Production authentication uses JWT with server-checked active-session state; Express sessions remain for local compatibility. A visible-tab check runs about every 15 seconds, and protected API requests also validate the session. A new sign-in invalidates the previous active session for that account.
- Password recovery generates a cryptographically random temporary password. Its database update is rolled back if the email provider rejects the dispatch request. Provider acceptance does not, by itself, guarantee final mailbox delivery.
- A display guard directs phone-sized screens and portrait tablets to a desktop or landscape-tablet experience suitable for the estate map.

## Architecture

```text
Browser: React SPA + Leaflet
    │  HTTPS / JWT
    ▼
Express 5 API on Render
    ├── Helmet, CORS, rate limits, authentication, role checks
    ├── Lot, customer, transaction, and audit services
    ├── Background reminder scheduler ──────► Brevo email API
    └── mysql2 connection pool ── verified TLS ──► Aiven MySQL
```

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React 18, React Router 7, TanStack Query, Tailwind CSS, Lucide | Role-based screens, forms, data fetching, and navigation |
| Spatial UI | Leaflet, React-Leaflet, SVG geometry | Lot inspection, map layers, plan overlays, and geographic editing |
| Reporting | Recharts | Dashboard and sales visualizations |
| API | Node.js 20+, Express 5 | Routes, business rules, validation, and scheduled work |
| Security | JWT, local `express-session`, Helmet, CORS, `express-rate-limit` | Session enforcement, browser policy, and request protection |
| Persistence | MySQL 8, `mysql2` pool | Properties, lots, customers, transactions, and audit data |
| Hosted services | Render, Aiven MySQL, Brevo | Application hosting, managed database, and transactional email |
| Delivery checks | GitHub Actions | Backend tests, frontend tests, and production build on pull requests and `main` pushes |

## Repository map

```text
.
├── front-end/
│   ├── public/                 PWA assets and SPA redirect rule
│   └── src/                    Pages, components, hooks, map tools, tests
├── back-end/
│   ├── config/                 MySQL pool and verified-CA TLS configuration
│   ├── scripts/                Explicit migrations and read-only preflight
│   ├── src/                    Express app, routes, middleware, services
│   └── tests/                  Isolated safety tests and disposable-DB tests
├── docs/                       Production rollout and recovery runbook
├── database_Backup/            Existing SQL snapshots; handle as sensitive data
├── .github/workflows/          Automated verification workflow
└── package.json                npm workspace commands
```

## Run locally

**Prerequisites:** Node.js 20+ with npm, MySQL 8, and an **existing base schema**. The included migration scripts extend that schema; they do not create the entire application database from an empty instance.

1. Clone the repository and install from its root:

   ```bash
   git clone https://github.com/goldendragonestate/Digital-Lot-Tracker-System.git
   cd Digital-Lot-Tracker-System
   npm install
   ```

2. Create an ignored root `.env` with local settings:

   ```dotenv
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=change_me
   DB_NAME=golden_dragon_corp
   JWT_SECRET=use_a_long_unique_random_value
   SESSION_SECRET=use_a_different_long_unique_random_value
   FRONTEND_URL=http://localhost:3000
   ```

3. Confirm the database target, review the [rollout runbook](docs/production_rollout_runbook.md), and apply only the migrations needed for that schema. Do **not** run a broad setup or data backfill against client records without a verified backup and review.
4. Start both development servers:

   ```bash
   npm run dev
   ```

| Service | Local address |
| --- | --- |
| React application | `http://localhost:3000` |
| Express API | `http://localhost:5000` |
| API/database readiness | `http://localhost:5000/api/health` |
| API liveness only | `http://localhost:5000/live` |

Set `REACT_APP_API_URL` in an ignored `front-end/.env.local` only when the frontend must call a non-default API. React embeds this value **at build time**; restart or rebuild after changing it.

### Environment and secrets

| Variable | Where | Purpose |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Backend | MySQL connection target and credentials |
| `DB_SSL=true` | Backend/cloud scripts | Requests TLS for a remote database; Aiven hosts also trigger TLS automatically |
| `DB_SSL_CA` **or** `DB_SSL_CA_PATH` | Backend/cloud scripts | Aiven CA certificate as PEM content or path to a private PEM file; required for verified TLS |
| `JWT_SECRET` | Backend | Production token signing; use a long, unique secret |
| `SESSION_SECRET` | Backend | Local Express-session compatibility secret |
| `FRONTEND_URL` | Backend | Allowed browser origin for cross-origin requests |
| `BREVO_API_KEY`, `EMAIL_USER` | Backend | Transactional-email API key and sender address |
| `REACT_APP_API_URL` | Frontend build | Public API base URL embedded in the SPA bundle |

For Aiven, download the service CA certificate and supply it through the host's secret environment or a private file. `DB_SSL_CA` accepts PEM text with escaped `\n` line breaks. The backend **refuses a TLS-enabled database connection without a CA**; do not reintroduce `rejectUnauthorized: false`. Never commit `.env` files, API keys, passwords, or newly exported database dumps.

## Database migrations and release preflight

Confirm which database the environment variables select **before** running any command below. Back up and rehearse restoration in staging before writes to an existing client database.

| Task | Command | Effect |
| --- | --- | --- |
| Read-only schema and integrity gate | `npm --prefix back-end run db:preflight` | Checks required tables/columns and aggregate anomalies; no writes |
| Login-history table | `npm --prefix back-end run db:migrate-login-history` | Creates the account sign-in history table if missing |
| Sale-date audit table | `npm --prefix back-end run db:migrate-sale-date-audit` | Creates the append-only sale-date audit table if missing |
| Non-saleable classification preview | `node back-end/scripts/migrate_non_saleable_column.js --dry-run` | Reports candidate parcels and conflicts without writes |
| Non-saleable classification apply | `node back-end/scripts/migrate_non_saleable_column.js` | Adds/backfills classification after human review |
| Historical date-provenance preview | `node back-end/scripts/migrate_date_provenance.js --plan` | Reports proposed classifications without writes |
| Historical date-provenance apply | `node back-end/scripts/migrate_date_provenance.js` | Alters/backfills provenance; **write operation** |

`npm run db:setup` is a broader schema/backfill operation and requires separate review. The API startup currently attempts to ensure `lots.sold_on` exists; a startup warning is not evidence that all other migrations are complete. Run the read-only preflight **against the actual release database** after migration, then review its counts. A local PASS does not certify production.

> [!IMPORTANT]
> `database_Backup/` contains tracked SQL snapshots, including admin and employee rows with password fields. Treat the repository and its history as sensitive. `.gitignore` prevents new dumps from being added automatically, but it does **not** remove already tracked files or past commits. Plan any history cleanup and credential rotation with the repository owner; never delete the only recoverable backup.

## Tests and continuous integration

Run the non-destructive checks from the repository root:

```bash
npm --prefix back-end test
npm --prefix front-end test -- --watchAll=false
npm run build
npm --prefix back-end run db:preflight
```

Backend unit tests cover password-reset rollback, CA-enforced database TLS, and the read-only preflight. The frontend test covers phone, portrait-tablet, narrow-desktop, and supported-desktop guard states. The [GitHub Actions workflow](.github/workflows/verify.yml) runs tests and the frontend production build for pull requests and pushes to `main` once that workflow is committed.

<details>
<summary>Optional disposable-database integration tests</summary>

`back-end/tests/disposable_migration_safety.test.js` and `back-end/tests/disposable_reversal_acceptance.test.js` create and remove uniquely named **local** test databases. Read their safeguards first, use a local MySQL account with database-creation privileges, and never target Aiven or client production data.

</details>

## Production rollout

1. **Secure the repository and data.** Restrict access to tracked SQL snapshots; agree on a backup, history-remediation, and credential-rotation plan before wider distribution.
2. **Prepare Aiven and secrets.** Provision MySQL, verify the database target, and configure `DB_SSL_CA` or `DB_SSL_CA_PATH` on the backend before deploying TLS-enforcing code. Set strong `JWT_SECRET`, `FRONTEND_URL`, and email settings where used.
3. **Back up and rehearse.** Follow the [production rollout runbook](docs/production_rollout_runbook.md), take a restorable database snapshot, review migration plans, and test the sequence in staging.
4. **Migrate deliberately.** Run only approved migrations against the intended database. Confirm `npm --prefix back-end run db:preflight` reports PASS and review any undated sold lots separately.
5. **Deploy the API.** Configure a Render web service with the repository-root install command `npm ci` and start command `npm --prefix back-end start`. Confirm `/live` and `/api/health`, then test an authenticated API operation.
6. **Deploy the SPA.** Configure a Render static site with build command `npm ci && npm run build`, publish directory `front-end/build`, and set `REACT_APP_API_URL` to the backend URL. The frontend includes an SPA redirect rule for deep links.
7. **Smoke-test the workflow.** Verify administrator and employee sign-in, concurrent-session invalidation, map loading, reservation, sale and reversal behavior, historical reporting, and desktop/landscape-tablet layouts using non-client test records. Monitor logs before inviting users.

The source build, local tests, and a green health endpoint are **not** substitutes for staging rehearsal or production smoke tests. Do not infer data-migration success from `/api/health`: it checks connectivity, while `db:preflight` checks release-critical schema and aggregate invariants.

## Ownership and use

Copyright © Golden Dragon Estate Corporation. All rights reserved. This project is intended for authorized use in Golden Dragon Estate operations; obtain written permission before reuse or redistribution.

The repository has **no standalone license file**, while `back-end/package.json` currently lists `ISC`. These statements must be reconciled with the project owner or legal counsel before publishing a definitive software license or distributing the source.
