<div align="center">

<img src="front-end/src/assets/image/golden-dragon-logo.png" alt="Golden Dragon Estate logo" width="96" />

# Golden Dragon Estate Platform

**Subdivision inventory, reservations, and sales in one workspace.**

An estate management platform for Golden Dragon Estate Corporation, built around an interactive lot map and traceable sales records.

[Open application](https://goldendragonestate.onrender.com) · [Documentation](#documentation) · [Development setup](docs/local-development.md)

</div>

## Overview

The platform helps administrators and agents view subdivision inventory, manage reservations, and review sales activity. Lot details, buyer information, and agent attribution are connected so teams can follow a record from reservation through sale.

Designed for **desktop computers and tablets in landscape orientation**. Phone-sized screens, portrait tablets, and narrow desktop windows display a notice before access to the workspace or sign-in.

## Key capabilities

- **Interactive estate map** — Browse lots, subdivision plans, and property details. Parks and other non-saleable areas stay separate from saleable inventory.
- **Reservations and sales** — Manage Available, Pending, and Sold statuses with server-side validation and controlled sale reversals.
- **Past sales records** — Preserve original sale dates and agent attribution. Records with unknown sale dates remain separate from monthly totals.
- **Reports and team activity** — Review sales by year and subdivision, shared transactions, and personally attributed sales.
- **Account management** — Manage staff access, review sign-in history, and send reservation reminders.

Administrators manage inventory, staff, and reporting. Employees work with clients and reservations, view team activity, and access their personal sales view. See [Architecture and capabilities](docs/architecture.md) for access boundaries and functional scope.

## Documentation

| Guide | What you will find |
| --- | --- |
| [Architecture and capabilities](docs/architecture.md) | System structure, roles, business rules, and limitations |
| [Local development](docs/local-development.md) | Installation, environment configuration, and test commands |
| [Deployment configuration](docs/deployment.md) | Hosting settings, build configuration, and release checks |
| [Production rollout runbook](docs/production_rollout_runbook.md) | Database migrations, backups, verification, and recovery |

## Technology

**Frontend:** React 18 · Create React App · React Router 7 · Tailwind CSS · Leaflet

**Backend:** Node.js · Express 5 · MySQL 8

**Services:** Render hosting · Aiven MySQL · Brevo email

## Getting started

For local development, install Node.js and MySQL 8, prepare an existing application database, and configure the environment using the [setup guide](docs/local-development.md). CI uses Node.js 24. Once setup is complete, run from the repository root:

```bash
npm install
npm run dev
```

The frontend opens at `http://localhost:3000`; the API runs at `http://localhost:5000` by default. Database migrations are separate operations and require a verified database target.

## Production operations

Use the [deployment guide](docs/deployment.md) to configure hosting and the [rollout runbook](docs/production_rollout_runbook.md) to record release verification and approval. The runbook covers backup, migration, recovery, and application checks.

Repository access and map-provider requirements are documented in the deployment guide. The tracked `database_Backup/` directory contains sensitive SQL snapshots and requires restricted access.

## Ownership

Copyright © Golden Dragon Estate Corporation. All rights reserved. Authorized operational use only. The repository has no standalone license file, while `back-end/package.json` lists `ISC`; the owner must reconcile these statements before source redistribution.
