# Local development

## Prerequisites

- Node.js 20+ and npm
- MySQL 8 with an **existing base application schema**
- Credentials for an authorized development database

The included migration scripts extend an existing schema; they do not create the entire application database from an empty instance. Never point a development command at a client or production database without following the [production rollout runbook](production_rollout_runbook.md).

## Start the application

From the repository root:

```bash
git clone https://github.com/goldendragonestate/Digital-Lot-Tracker-System.git
cd Digital-Lot-Tracker-System
npm install
```

Create an ignored root `.env` for **local development**:

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

Inspect the database target and apply only approved migrations required by that schema. Then start both development servers:

```bash
npm run dev
```

| Service | Local URL |
| --- | --- |
| React application | `http://localhost:3000` |
| Express API | `http://localhost:5000` |
| API/database readiness | `http://localhost:5000/api/health` |
| API liveness only | `http://localhost:5000/live` |

When browsing at `localhost` or `127.0.0.1`, the frontend defaults to `http://localhost:5000`. On any other hostname, including a local network IP, it defaults to the live Render backend unless `REACT_APP_API_URL` is set.

For testing on another device on your network, explicitly set `REACT_APP_API_URL=http://<development-computer-IP>:5000` in an ignored `front-end/.env.local`, and set the backend's `FRONTEND_URL=http://<development-computer-IP>:3000`. Replace the placeholders with the actual development computer's IP, confirm the backend uses your development database, and allow the required ports only on the trusted local network. Use a tablet in landscape or a desktop; phone-sized screens are blocked by the display guard.

Create React App embeds `REACT_APP_API_URL` at build time. Restart the development servers after changing these settings, or rebuild for a static deployment.

## Configuration reference

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Backend and explicit database scripts | MySQL target and credentials |
| `DB_SSL=true` | Backend/cloud scripts | Requests TLS; Aiven hosts trigger TLS automatically |
| `DB_SSL_CA` or `DB_SSL_CA_PATH` | Backend/cloud scripts | PEM CA content or private file path for verified TLS |
| `JWT_SECRET` | Backend | Production token signing secret |
| `SESSION_SECRET` | Local backend | Express-session compatibility secret |
| `FRONTEND_URL` | Backend | Allowed browser origin |
| `BREVO_API_KEY`, `EMAIL_USER` | Backend | Transactional email API key and sender address |
| `REACT_APP_API_URL` | Frontend build | Public API base URL embedded in the SPA |

For Aiven, use the service CA certificate through the hosting environment's secret store or a private file. `DB_SSL_CA` accepts PEM text with escaped `\n` line breaks. TLS connections without a CA fail by design; do not disable certificate validation. Never commit `.env` files, passwords, API keys, or database exports.

The reminder cutoff needs **no new environment variable**. It is stored in the existing `system_state` table. If that table is missing, create it only through the approved explicit migration described in the [runbook](production_rollout_runbook.md), not on application startup.

## Local, non-destructive checks

Run from the repository root:

```bash
npm --prefix back-end test
npm run build
```

For frontend tests, use the command for your shell:

```bash
# Bash/sh
CI=true npm --prefix front-end test
```

```powershell
# PowerShell
$env:CI = 'true'
npm --prefix front-end test
```

`npm --prefix back-end run db:preflight` is read-only **but connects to the selected database**. Confirm `DB_*` target values before running it; a local PASS does not certify Aiven or production. The test suite and build do not replace staging or a production smoke test.

The optional disposable-database integration tests under `back-end/tests/` create and remove uniquely named **local** test databases. Review their safeguards before running them and never point them at Aiven or client data.
