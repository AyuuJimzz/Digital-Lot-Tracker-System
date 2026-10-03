<div align="center">

<img src="front-end/src/assets/image/golden-dragon-logo.png" alt="Golden Dragon Estate logo" width="96" />

# Golden Dragon Estate Platform

**Digital lot tracking and subdivision estate management**

An interactive estate map and auditable workflow for lot inventory, reservations, historical sales, and staff operations.

[Application URL](https://goldendragonestate.onrender.com)

</div>

> [!IMPORTANT]
> This README describes the deployed application and its documentation. Release approval is recorded through the [production rollout runbook](docs/production_rollout_runbook.md), including backup, staging, database preflight, smoke tests, and owner sign-off.

## What the platform does

- Maps lots and subdivision plans while keeping non-saleable parcels outside saleable inventory.
- Tracks Available, Pending, and Sold lots with backend-controlled status transitions.
- Preserves customer, agent, transaction, and historical sale-date context for review.
- Provides administrator reporting and employee views for shared estate activity and personally attributed sales.

The stack is React 18, Create React App, React Router 7, Leaflet, Node.js/Express 5, and MySQL 8. The backend is configured for Render, Aiven MySQL with verified CA/TLS, and Brevo email. See [Architecture and capabilities](docs/architecture.md) for scope and limitations.

## Documentation

| Read this | For |
| --- | --- |
| [Architecture and capabilities](docs/architecture.md) | Workspaces, map, business rules, stack, and known limitations |
| [Local development](docs/local-development.md) | Installation, local environment, commands, and tests |
| [Deployment configuration](docs/deployment.md) | Render settings, CI behavior, repository safety, and release verification |
| [Production rollout runbook](docs/production_rollout_runbook.md) | Approved migration order, backup/staging gates, recovery, and final sign-off |

## Quick local start

Requires Node.js 20+, MySQL 8, and an existing base application schema. From the repository root:

```bash
npm install
npm run dev
```

Configure an ignored root `.env` for your **local development database** first; see [Local development](docs/local-development.md). Do not run migration scripts or `db:preflight` against an unverified target. Database migrations are explicit operations, not part of normal server startup.

## Release boundary

Before publishing changes, verify the destination repository and branch, review the diff, run tests and the build, and follow the [runbook](docs/production_rollout_runbook.md) for every production release—especially one affecting the database. Repository push targets, CI gating, and Render settings are documented in [Deployment configuration](docs/deployment.md).

The tracked `database_Backup/` directory contains sensitive SQL snapshots. Restrict access and resolve the repository-history and credential-rotation plan before wider distribution. Map tile-provider rights and attribution also require review before commercial rollout.

## Ownership

Copyright © Golden Dragon Estate Corporation. All rights reserved. Authorized operational use only. The repository has no standalone license file, while `back-end/package.json` lists `ISC`; the owner must reconcile these statements before source redistribution.
