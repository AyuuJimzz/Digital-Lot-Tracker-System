<div align="center">

<img src="front-end/src/assets/image/golden-dragon-logo.png" alt="Golden Dragon Estate logo" width="88" />

# Golden Dragon Estate Platform

An estate-management application for mapping subdivision lots, managing reservations and sales, and coordinating administrators and employees.

[Live application](https://goldendragonestate.onrender.com)

</div>

## Overview

The platform combines an interactive lot map with property, customer, transaction, and employee workflows. Administrators manage inventory and staff; employees work with their assigned clients and sales. The frontend is a React single-page application backed by an Express API and MySQL.

### Main capabilities

- **Estate map:** View property boundaries and lot details, switch map layers, and update lot information from the map interface.
- **Inventory and reservations:** Track Available, Pending, and Sold lots. Non-saleable parcels are classified separately from saleable inventory.
- **Customer and sales records:** Manage reservations, customer details, transactions, and agent attribution.
- **Employee management:** Add employees, review activity, deactivate accounts, and reassign pending clients when staff responsibilities change.
- **Account security:** Role-based access, session checks, profile settings, and recent sign-in history.
- **Blueprint tools:** Import and align subdivision plans with the map for lot placement and editing.

## Technology

| Layer | Main tools |
| --- | --- |
| Frontend | React 18, React Router 7, Tailwind CSS, React Query |
| Maps and charts | Leaflet, React-Leaflet, Recharts |
| API | Node.js, Express 5 |
| Database | MySQL 8, `mysql2` |

## Repository layout

```text
back-end/
  config/       Database connection configuration
  scripts/      Explicit database setup and migrations
  src/          API routes, controllers, middleware, and services
  tests/        Database safety integration tests
front-end/
  public/       Static assets and PWA files
  src/          React pages, components, hooks, and API configuration
database_Backup/  SQL snapshots; review their contents before use
docker-compose.yml  Optional local container stack
package.json        Workspace-level commands
```

## Local development

### Requirements

- Node.js 20 or later and npm
- MySQL 8 with an existing Golden Dragon Estate base schema

Install the workspace dependencies from the repository root:

```bash
npm install
```

Create a root `.env` file for the backend and replace the example values:

```dotenv
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_password
DB_NAME=golden_dragon_corp
JWT_SECRET=replace_with_a_long_random_secret
SESSION_SECRET=replace_with_a_different_long_random_secret
FRONTEND_URL=http://localhost:3000
```

The root `.env` is ignored by Git. Do not commit secrets or production database credentials. If email delivery is needed, configure `BREVO_API_KEY` and `EMAIL_USER` in the same file. For a remote MySQL connection, configure the appropriate `DB_HOST`, `DB_PORT`, credentials, and `DB_SSL=true`. TLS connections also require Aiven's CA certificate: set `DB_SSL_CA_PATH` to a private PEM file on the server, or set `DB_SSL_CA` to the PEM content in the host's secret environment variables (escaped newlines are accepted). Never commit the certificate or disable certificate verification. Configure the CA **before** deploying backend changes; the backend now refuses TLS connections without it.

The database scripts extend an **existing** schema; they do not create all base tables from an empty database. Review the SQL snapshots in `database_Backup/` before using them, particularly if they contain real records. Once the base tables exist, review `back-end/scripts/setup_schema.js` before running `npm run db:setup`: it performs data backfills as well as schema changes.

Start both development servers:

```bash
npm run dev
```

| Service | Local URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| API | `http://localhost:5000` |
| API and database readiness | `http://localhost:5000/api/health` |

The frontend defaults to the local API during development. To override it, set `REACT_APP_API_URL` in an ignored `front-end/.env.local` file. React reads this value at build time, so restart or rebuild the frontend after changing it.

## Database changes

Run migrations only against the database you intend to change. Confirm the active `DB_*` values and take a backup before applying changes to an existing or production database.

| Change | Command | Notes |
| --- | --- | --- |
| Login-history table | `npm --prefix back-end run db:migrate-login-history` | Creates `account_login_history` if it does not exist. |
| Non-saleable lot classification preview | `node back-end/scripts/migrate_non_saleable_column.js --dry-run` | Inspects candidates without schema or data writes. |
| Non-saleable lot classification | `node back-end/scripts/migrate_non_saleable_column.js` | Adds/backfills `lots.is_non_saleable`; review the preview and any reported conflicts first. |

`npm run db:setup` is a broader setup/backfill script, not a substitute for reviewing the targeted migrations. Normal API startup does not run schema migrations automatically.

## Verification

Build the frontend:

```bash
npm run build
```

Run the backend's database safety integration suite:

```bash
node back-end/tests/disposable_migration_safety.test.js
```

The integration suite creates and removes a disposable local MySQL database. It requires a local MySQL account with database-creation privileges; inspect the test's safety checks before running it in a new environment. Do not point it at a production database.

## Deployment notes

- Set the backend `DB_*`, `JWT_SECRET`, `SESSION_SECRET`, and `FRONTEND_URL` values in the hosting environment. Configure email variables only if email delivery is used.
- Set `REACT_APP_API_URL` for the frontend build when the API is hosted at a different URL. The value is embedded in the built frontend.
- Apply and verify required database migrations before deploying code that depends on the new columns or tables.
- Check `/live` for API liveness and `/api/health` for API-plus-database readiness after deployment.

This repository does not currently contain a license file. Contact the project owner before reusing or redistributing its code or assets.
