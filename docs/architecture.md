# Architecture and capabilities

Golden Dragon Estate Platform is a React single-page application backed by an Express API and MySQL. It connects subdivision plans, geographic lot geometry, customer records, and sales activity in one workflow.

## Workspaces

| Workspace | Main responsibilities |
| --- | --- |
| Administrator | Property and lot inventory, staff access, map/blueprint alignment, sale-date corrections, and reporting |
| Employee | Estate map and lot browsing, client and reservation work, personal sales view, and team activity |

`My Sales` requests personal transactions, while other employee-authorized endpoints expose shared estate data for operational use. Do not treat the name of a screen as a backend access-control boundary.

## Core capabilities

- **Spatial inventory:** Leaflet map, searchable lot labels, vector geometry, property metadata, and satellite/streets/hybrid layers. Lots can exist without polygon coordinates.
- **Blueprint alignment:** PDF, PNG, JPG, and WebP site plans can be aligned against geographic coordinates for tracing or importing lot candidates. Native DWG/DXF import is not implemented.
- **Saleable inventory:** Explicit non-saleable classification separates parks, facilities, and excluded parcels from saleable totals and blocks their reservation or sale through the API.
- **Status and sales controls:** Authenticated lot transitions use backend checks, transactions, and row locking. A Sold lot cannot go directly to Pending; administrator-controlled reversal follows a separate path.
- **Historical reporting:** Verified sale dates are distinguished from unknown or synthetic legacy dates. Reversals and cancellations are excluded from completed-sale analytics; undated sold lots are not assigned an invented month.
- **Attribution and audit:** Agent names remain associated with historical records after account deactivation or deletion. Transaction, activity, login, and sale-date audit data support review. A company-direct legacy entry can be marked `Old Record`.
- **Accounts and reminders:** JWT authentication checks active sessions; local development retains Express-session compatibility. Reservation reminders use a persistent cutoff and an at-most-once attempt per stage.

The recorded payment **method** (for example, Cash or Installment) is not a complete installment ledger or accounting module.

## System layout

```text
Browser: React 18 SPA + React Router 7 + Leaflet
    │ HTTPS / JWT
    ▼
Express 5 API on Render
    ├── Authentication, role checks, validation, rate limits
    ├── Lot, customer, transaction, and audit controllers
    ├── Reminder scheduler ───────────────► Brevo HTTPS email API
    └── mysql2 pool ── verified CA/TLS ──► Aiven MySQL
```

| Layer | Implementation |
| --- | --- |
| Frontend | React 18, Create React App, React Router 7, TanStack Query, Tailwind CSS, Lucide |
| Map | Leaflet, React-Leaflet, SVG lot geometry and plan overlays |
| Charts | Recharts |
| API | Node.js, Express 5 |
| Database | MySQL 8 through `mysql2` |
| CI | GitHub Actions backend tests, frontend tests, and frontend build |

## Repository layout

```text
front-end/        SPA, map tools, public assets, and frontend tests
back-end/         Express API, database scripts, and backend tests
docs/             Development, deployment, and release procedures
database_Backup/  Existing tracked SQL snapshots; sensitive data
.github/workflows/ CI verification
```

## Map-provider boundary

The current frontend requests tiles from direct `mt{s}.google.com` URLs and uses OpenStreetMap Nominatim for geocoding; these are different services. Map attribution is disabled in the Leaflet containers. Before commercial production use, the project owner must confirm an authorized tile provider, its terms, required attribution, and permitted caching. Do not infer a license from the map working in a browser. See [Google Maps Tile API policies](https://developers.google.com/maps/documentation/tile/policies) for an example of provider requirements.
