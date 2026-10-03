# Production rollout runbook

**System:** Golden Dragon Estate Platform

**Scope:** Backend, React SPA, Aiven MySQL, historical sale-date provenance, and lot inventory
**Status:** Operational procedure; **no live rollout is certified by this document**

> [!IMPORTANT]
> This runbook is not authorization to alter client data or deploy a release. An operator must confirm the target database, secure a recoverable backup, rehearse in staging, and obtain the project owner's approval before any production write. Stop at a failed gate; do not improvise a destructive rollback.

## 1. Record the release and owners

Complete a release record before opening a change window. Keep credentials, database dumps, and customer details **out** of the record and ticket attachments.

| Item | Record before execution |
| --- | --- |
| Release commit and build artifact | Exact Git SHA and deployment identifier |
| Application URLs | Frontend and backend URLs to be changed |
| Target database | Service name and environment (staging or production) |
| Change window and rollback owner | Approved time, operator, and decision maker |
| Backup | Restricted location, timestamp, size, and restore-test evidence |
| Staging evidence | Test results, migration plan, and preflight output |
| Production sign-off | Named approver and time of approval |

The [README](../README.md) is the documentation index; [architecture](architecture.md), [local development](local-development.md), and [deployment configuration](deployment.md) have the supporting details. This runbook focuses on **release order, evidence, and stop conditions**.

## 2. Preconditions and stop/go gates

- [ ] Confirm the release SHA, Git diff, and exact production/staging targets. Do not infer the target from a developer machine's `.env`.
- [ ] Set Aiven's CA certificate in the backend and migration environment through `DB_SSL_CA` or `DB_SSL_CA_PATH`. A cloud connection now fails without a CA; never bypass certificate validation.
- [ ] Ensure a MySQL 8 client can connect with CA and hostname verification, and that the migration account has only the privileges required for the approved steps.
- [ ] Agree on a low-traffic window and how new reservations/sales will be paused if a stop condition occurs.
- [ ] Review repository access: tracked `database_Backup/` snapshots include admin and employee rows with password fields. A new `.gitignore` rule does not erase those files from the current tree or Git history. Restrict access and plan reviewed remediation/credential rotation before broader distribution.
- [ ] Review map-provider authorization and attribution for commercial use; the frontend currently requests direct Google tile URLs with Leaflet attribution controls disabled.
- [ ] Confirm the intended Git push destination; this development checkout has multiple `origin` push URLs. Verify Render's linked repository, branch, and Auto-Deploy policy rather than assuming that a push waits for CI.
- [ ] Run backend tests, frontend tests, and the frontend build for the **same commit** intended for release. A passing build is not a production smoke test.
- [ ] Rehearse this entire sequence against an isolated staging copy before production.

### Pending reservation reminder rollout

The reminder service needs **no new environment variable**. Before the backend starts accepting reservations, it atomically records the database server's current time in the existing `system_state` table as `reminder_cutoff`. All instances read the same stored value on restart. Reservations with `pending_since` at or before that second are excluded without changing their records; later reservations are eligible for the 12-hour and 24-hour reminders. The same-second exclusion favors not emailing a pre-rollout customer over delivering a reminder to a reservation created during that one-second boundary.

The `system_state` table must already exist as part of the approved schema. If absent, create it with the explicit `db:migrate-system-state` step **after the backup**, before deploying the backend; normal startup and the reminder job do not create tables. If the table is unavailable, production startup waits without accepting traffic. If cutoff initialization fails after state sync, startup exits; an email run also fails closed without querying Pending lots. Inspect the stored `reminder_cutoff` during staging and before production activation. If an earlier version of the reminder code has already initialized it, do not silently overwrite it—review that value and its effect on existing reservations with the project owner.

Reminder delivery is **at most one attempt per stage**, not guaranteed delivery: a crash or ambiguous provider timeout leaves the attempt claimed to avoid duplicate customer emails. Inspect server/email-provider logs and resolve such cases manually. The manual trigger is admin-only `POST /api/lots/send-pending-reminders`; GET no longer sends email.

> [!CAUTION]
> Stop if the target database is uncertain, the CA is missing, the backup is not restorable, migration classifications are disputed, or staging fails. Do not run `npm run db:setup` as a generic repair: it performs multiple schema changes and data backfills.

## 3. Staging rehearsal

1. Restore a **separate, access-controlled** snapshot into staging. Confirm it is not connected to production accounts, email recipients, or schedulers.
2. Run the applicable migration previews and inspect aggregate counts. Resolve ambiguous sale dates with staff evidence; a valid customer or lot link **alone does not verify a sale date**.
3. Apply the approved migrations in staging in the order below. Run `npm --prefix back-end run db:preflight` and investigate every failure.
4. Exercise administrator and employee flows with designated test records: sign-in, map load, Pending reservation, Sold transition, reversal, historical date correction, and report-year selection.
5. Repeat the migration in staging only if the team is intentionally testing idempotency. **Do not rerun a production data migration merely as an idempotency check.**

Record the staging row counts and classifications without exporting buyer details into logs or screenshots.

## 4. Production backup and recovery gate

Take a backup **before** any production DDL or data backfill. Store it outside the repository in a restricted location. The following example is for **PowerShell with a MySQL 8 client**; it is documentation, not a command run by this project. The operator must set the `DB_*` and `BACKUP_DIR` environment variables for the approved target first.

```powershell
$required = @('DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME', 'DB_SSL_CA_PATH', 'BACKUP_DIR')
foreach ($key in $required) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key))) {
    throw "Missing required environment variable: $key"
  }
}
if (-not (Test-Path -LiteralPath $env:DB_SSL_CA_PATH -PathType Leaf)) { throw 'CA file not found' }
if (-not (Test-Path -LiteralPath $env:BACKUP_DIR -PathType Container)) { throw 'Backup directory not found' }

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$backupFile = Join-Path $env:BACKUP_DIR "golden-dragon-pre-release-$stamp.sql"
if (Test-Path -LiteralPath $backupFile) { throw 'Backup file already exists; choose a new name' }

mysqldump --host="$env:DB_HOST" --port="$env:DB_PORT" --user="$env:DB_USER" --password `
  --ssl-mode=VERIFY_IDENTITY --ssl-ca="$env:DB_SSL_CA_PATH" `
  --single-transaction --quick --triggers --routines --events --no-tablespaces `
  --result-file="$backupFile" "$env:DB_NAME"
if ($LASTEXITCODE -ne 0) { throw 'mysqldump failed; do not continue' }
if ((Get-Item -LiteralPath $backupFile).Length -eq 0) { throw 'Backup is empty; do not continue' }
```

`--password` prompts without putting the password in the process command line. The CLI CA file is distinct from a PEM value stored in `DB_SSL_CA`. MySQL recommends `--result-file` on Windows because PowerShell redirection can change dump encoding; `--ssl-mode=VERIFY_IDENTITY` validates the CA **and** hostname. `--single-transaction` gives a consistent snapshot for transactional tables such as InnoDB, provided concurrent DDL is avoided. See the [MySQL client TLS options](https://dev.mysql.com/doc/refman/8.0/en/connection-options.html) and [mysqldump guidance](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html).

**Backup acceptance requires more than a non-empty file:** confirm expected schema/table coverage and row counts, restrict file access, and rehearse restoration into an isolated database. A successful dump command alone is not proof of recoverability. Do not restore over production to perform this test.

## 5. Classify historical data before writes

Inspect the schema first. `migrate_date_provenance.js --plan` relies on `lots.sold_on`; if that column is missing, the additive `db:migrate-lot-status-dates` step must be reviewed and run **after the backup** before the plan can execute.

```sql
SHOW COLUMNS FROM lots LIKE 'sold_on';
SHOW COLUMNS FROM transactions WHERE Field IN ('is_date_verified', 'date_provenance');
SHOW TABLES LIKE 'system_state';
SHOW TABLES LIKE 'sale_date_audit';
```

With the required base schema present, run the non-mutating previews against the **verified target**:

```bash
node back-end/scripts/migrate_non_saleable_column.js --dry-run
node back-end/scripts/migrate_date_provenance.js --plan
```

The provenance plan partitions transactions into verified, known synthetic backfills, unknown records requiring review, and reversals/cancellations. Confirm:

- `verified + known backfill + unknown + reversal = total transactions`;
- synthetic reservation rows are not treated as verified sales;
- historical dates are supported by actual records rather than inferred from customer/lot linkage;
- non-saleable candidates and conflicts have been reviewed by an authorized operator.

If the plan cannot run because the schema is incomplete, do **not** guess values or use an unreviewed broad setup script. Resolve the prerequisite migration first. If any count or classification is disputed, stop and document the record-level review outside this runbook.

## 6. Apply only approved migrations

The commands below **write to the selected database** unless marked preview. Run only the steps required by the inspected schema and approved release plan. Use the environment-backed connection; do not paste database URLs containing passwords into shell commands or tickets.

| Order | Operation | Command | Expected effect |
| --- | --- | --- | --- |
| 0, if missing | Durable system-state table | `npm --prefix back-end run db:migrate-system-state` | Creates `system_state`; required before backend startup |
| 1, if missing | Lot sale-date column | `npm --prefix back-end run db:migrate-lot-status-dates` | Adds nullable `lots.sold_on`; does not invent old sale dates |
| 2, if missing | Login-history storage | `npm --prefix back-end run db:migrate-login-history` | Creates `account_login_history` |
| 3, if missing | Sale-date correction audit | `npm --prefix back-end run db:migrate-sale-date-audit` | Creates `sale_date_audit` |
| 4, after preview | Non-saleable classification | `node back-end/scripts/migrate_non_saleable_column.js` | Adds/backfills `lots.is_non_saleable`; review conflicts first |
| 5, after plan approval | Transaction date provenance | `node back-end/scripts/migrate_date_provenance.js` | Adds/backfills verification and provenance columns; default invocation **applies writes** |

Run database migrations before deploying backend code that depends on the new fields. Normal web-service startup does not alter database tables or backfill records; it does write the single `reminder_cutoff` key if absent. Migrations must be explicitly executed and verified with `db:preflight` before opening traffic. The provenance migration does not rewrite the original `transaction_date`, and the audit-table migration does not reconstruct corrections that occurred before it existed.

Stop immediately on SQL errors, unresolved classification conflicts, or a mismatch between the approved plan and observed results. Preserve logs and the post-error database state for diagnosis; do not automatically retry a partially completed production migration.

## 7. Verify database state before deploying

Run the release gate against the **actual migrated target**, not only localhost. It uses the `DB_*` values in the process environment (falling back to the repository-root `.env`); the command itself does not select Aiven automatically. Verify the target identity without disclosing credentials before running:

```bash
npm --prefix back-end run db:preflight
```

This command is read-only. It checks required tables/columns and aggregate counts for non-saleable parcels in Pending/Sold, invalid verified dates, and verified reversal rows. `undated_sold_lots` is reported for staff review, not automatically classified as a failure. A pre-migration FAIL for missing columns is expected; a **post-migration FAIL is a stop condition**.

For a second, read-only view of provenance distribution:

```sql
SELECT date_provenance, is_date_verified, COUNT(*) AS records
FROM transactions
GROUP BY date_provenance, is_date_verified;

SELECT COUNT(*) AS missing_sale_dates
FROM lots
WHERE status = 'Sold' AND sold_on IS NULL;
```

These counts do not prove every historical date is correct. Compare them with the approved plan and sample source documents under controlled access. Never change an unknown date to a guessed calendar date just to make the dashboard look complete.

## 8. Deploy and smoke-test

1. Confirm the deployed backend has the verified CA environment, correct database target, strong JWT secret, and intended `FRONTEND_URL`. Deploy the approved SHA to the Render web service.
2. Verify `/live` responds, then `/api/health` returns 200 with database connected. **Health checks only establish reachability and `SELECT 1`; the preflight is the schema gate.**
3. Build/deploy the React SPA for the intended `REACT_APP_API_URL`; it is embedded at build time. Confirm the deployed frontend corresponds to the same approved SHA. Verify the Render Static Site has a `/*` → `/index.html` Rewrite rule and directly refresh a deep link; the repository's `_redirects` file is not proof of a Render routing rule.
4. Use authorized admin and employee accounts to inspect the application. Protected endpoints require authentication; an anonymous 401 is expected, not a smoke-test failure.

| Read-only check | Expected evidence |
| --- | --- |
| `GET /api/lots/monthly-sales?year=YYYY` | 200 with `monthlyData`, `availableYears`, and `undatedSoldLots`; verify selected-year counts |
| `GET /api/transactions` | 200; old records appear under the intended filter/search behavior, without current-feed pollution |
| `GET /api/lots/map-data` and `GET /api/lots/all` | 200; statuses and non-saleable totals reconcile with inventory |
| `GET /api/lots/:id` | 200 for an authorized existing lot; metadata and any known `sold_on` load without schema errors |
| Browser UI | Admin/employee sign-in, map layers, year selector, history filters, tablet landscape, and no unexpected console/API errors |

Perform **mutating** reservation, sale, reversal, and historical-date tests in staging. Production mutation requires separate approval, a designated test record, and a reconciliation plan; never use an actual client's lot as an ad hoc test. Monitor application and database logs after opening access.

## 9. Incident response and rollback boundaries

If any gate fails, pause the release and coordinate a controlled stop to new writes. Preserve the current database state, error logs, release SHA, backup metadata, and the exact migration step reached. Diagnose with read-only metadata/count queries first.

> [!CAUTION]
> Do **not** run `DROP COLUMN`, truncate tables, or restore a pre-release dump over the live database as a reflex. A full restore can erase reservations, payments, and activity created since the backup. An application rollback is also not automatically safe if the old code assumes a different schema or authentication state.

Choose a targeted **forward fix** only after inspecting the actual state and rehearsing it in staging. If a restore is unavoidable, the DBA and business owner must approve a reconciliation plan for every post-backup write; use a separate recovery environment first. Preserve date-provenance and audit records throughout incident handling.

## 10. Final sign-off

Record evidence for this release. Leave a gate open if it cannot be verified; do not mark it complete based on a prior local test or a green `/api/health` response.

| Gate | Required evidence | Result |
| --- | --- | --- |
| Repository/security review | Backup access, history-remediation decision, secrets review | Not recorded |
| Map-provider review | Authorized tile source and visible, compliant attribution | Not recorded |
| Staging rehearsal | Restore test, migration plan, automated tests, workflow smoke test | Not recorded |
| Production backup | Verified protected file and isolated restore rehearsal | Not recorded |
| Production migration | Approved command log and aggregate reconciliation | Not recorded |
| Production preflight | PASS on the intended production database | Not recorded |
| Deployment parity | Approved SHA on backend and frontend | Not recorded |
| Authenticated smoke tests | Admin and employee read-only checks | Not recorded |
| Business acceptance | Named project owner and approval time | Not recorded |

**Release decision:** GO only when every applicable gate has evidence and an authorized owner signs off; otherwise NO-GO.
