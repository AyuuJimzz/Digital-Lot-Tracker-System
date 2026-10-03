# Deployment configuration and release workflow

This page describes service configuration. It is **not** authorization to deploy or alter a client database. The [production rollout runbook](production_rollout_runbook.md) is the release gate for target verification, backup, staging, migration approval, preflight, smoke tests, and sign-off.

## Before any push

1. Inspect the changed files and confirm the exact repository and branch intended for release. Do not stage everything indiscriminately.
2. Inspect `git remote -v` and `git config --get-all remote.origin.pushurl`. This checkout currently has **multiple `origin` push URLs**. Git pushes to every configured push URL; `git push origin main` is not a single-destination command here. Confirm the authorized destination and repository access before publishing anything.
3. Review the tracked `database_Backup/` SQL snapshots. They may include staff rows and password fields, and `.gitignore` does not erase files already committed or their history. Resolve access, backup, and credential-rotation decisions with the owner before wider distribution.
4. Run the backend tests, frontend tests, and production build for the exact release SHA. Prefer reviewed changes and CI verification before deployment. Do not treat a green build as business acceptance.

## Code-only versus database-changing releases

For a change that truly needs **no schema or data migration**, the release still needs review, CI, deployment verification, and smoke testing. Do not assume a feature is code-only from its UI appearance.

For a schema or data change, use the [runbook's ordered migration procedure](production_rollout_runbook.md#6-apply-only-approved-migrations). Confirm the exact database target, create and restore-test a protected backup, rehearse in isolated staging, inspect previews, execute only approved migrations, and obtain a PASS from `db:preflight` on the intended database **before** opening the new backend to traffic. Do not switch a developer machine's root `.env` to production as a shortcut.

The `system_state` table is an explicit migration prerequisite if missing; normal server startup does not create it. The reminder cutoff key is initialized automatically after the table exists and needs no extra `.env` variable. A `/api/health` response proves connectivity, not schema readiness.

## Render service configuration

Settings below are templates to verify in the Render Dashboard, **not** assertions about the current live services.

| Service | Root Directory | Build Command | Start / Publish |
| --- | --- | --- | --- |
| Backend web service | `back-end` | `npm ci` (using `back-end/package-lock.json`) | Start: `npm start` |
| Frontend static site | Repository root | `npm ci && npm run build` | Publish: `front-end/build` |

If the frontend service uses Root Directory `front-end` instead, its publish directory is `build`. Keep database migrations out of the build and startup commands. Set `REACT_APP_API_URL` to the intended backend URL **at frontend build time**, and configure the backend's `FRONTEND_URL` and verified Aiven CA for that frontend/database target.

For React Router deep links on Render Static Site, configure a **Rewrite** rule in the Render Dashboard: Source `/*`, Destination `/index.html`. The repository's `front-end/public/_redirects` file is not proof that this Render rule is active. Test a direct refresh on an authenticated route after deploy. See [Render's Create React App guide](https://render.com/docs/deploy-create-react-app).

Check each Render service's linked repository, branch, Root Directory, build/start commands, and Auto-Deploy setting. Render can deploy **On Commit**, **After CI Checks Pass**, or not automatically; choose the policy approved for the release. On Commit may start a deploy before the GitHub Actions checks finish. See [Render deployment settings](https://render.com/docs/deploys).

## Release verification

After an approved deploy, confirm the backend and frontend use the intended SHA. Check `/live`, `/api/health`, the authenticated read-only endpoints, deep links, map loading, and admin/employee screens. Exercise reservation, sale, reversal, and historical-date mutations in staging; production mutations require separately approved test records and reconciliation. Monitor application and database logs before inviting users.

The current direct Google tile endpoints and disabled Leaflet attribution require a provider/terms review before commercial rollout; see [Architecture and capabilities](architecture.md#map-provider-boundary). The source repository also has no standalone license file while `back-end/package.json` declares `ISC`; reconcile source-use rights with the owner before distributing the code.
