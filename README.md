<div align="center">

<img src="front-end/src/assets/image/golden-dragon-logo.png" alt="Golden Dragon Estate Logo" width="90" style="border-radius: 50%;" />

# Golden Dragon Estate Platform

**Modern GIS Subdivision Mapping, Digital Lot Tracking & Real Estate Sales Management System**

An enterprise full-stack web platform built for Golden Dragon Estate Corporation to manage subdivision lot inventories, interactive CAD & satellite mapping, agent sales pipelines, and customer reservations.

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Leaflet](https://img.shields.io/badge/GIS-Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MySQL](https://img.shields.io/badge/Database-MySQL_8-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Aiven Cloud](https://img.shields.io/badge/Cloud_DB-Aiven_MySQL-FF3E00?style=flat-square&logo=aiven&logoColor=white)](https://aiven.io/)
[![Render](https://img.shields.io/badge/Hosting-Render-46E3B7?style=flat-square&logo=render&logoColor=black)](https://render.com/)
[![Brevo](https://img.shields.io/badge/Email_API-Brevo-0B996F?style=flat-square&logo=brevo&logoColor=white)](https://www.brevo.com/)
[![Meta Messenger](https://img.shields.io/badge/Alerts-Meta_Messenger-00B2FF?style=flat-square&logo=messenger&logoColor=white)](https://developers.facebook.com/docs/messenger-platform/)
[![Docker](https://img.shields.io/badge/Containers-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br />

[**Explore Live Deployment — goldendragonestate.onrender.com**](https://goldendragonestate.onrender.com)

</div>

<br />

## Features

| Feature | Details |
| :--- | :--- |
| **Interactive GIS Engine** | 596+ georeferenced subdivision lots with high-precision polygon boundaries across Oton, Guimbal, and surrounding estates. Hardware-accelerated 60 FPS zoom with zero DOM churn. |
| **CAD Blueprint Tracing** | Official subdivision CAD overlays on live satellite imagery with real-time opacity, scale, and rotation controls for administrators. |
| **Road & Street Annotations** | Transparent, geo-anchored road width and street name text labels with deep-zoom level auto-filtering. |
| **Sales CRM Pipeline** | Scoped agent transaction management (`My Sales`, `My Clients`) tracking reservation status, lot dimensions, client history, and payment terms. |
| **Lot Status Architecture** | Synchronized status engine categorized into `Available` (Green), `Pending` (Amber/Gold), `Sold` (Red), and `Cancelled` (Purple). |
| **Dual Authentication** | Persistent 30-day session cookies paired with Bearer JWT tokens, single active device session enforcement, and role-based route guards. |
| **OWASP Top 10 Security** | 100% parameterized SQL queries, automated DOMPurify script sanitization on inputs, and brute-force rate limiters (5 attempts/15 min). |
| **Bi-Directional Cloud Sync** | 1-command database backup scripts synchronizing local Laragon environments with production Aiven Cloud MySQL over SSL. |
| **Automated Alerts & Brevo Email** | Transactional customer reservation receipts & OTP dispatches via Brevo HTTPS REST API, alongside real-time system health and customer lead alert push notifications routed directly to Meta Facebook Messenger via Graph API. |
| **PWA & Field Tablet Ready** | Progressive Web App with custom service worker asset caching, landscape viewport optimization, and an in-memory 43-LGU geocoding engine for Panay Island. |
| **Developer Console** | Protected administrative diagnostics suite featuring table storage inspection, system state audits, and configurable master PIN security. |

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, React Router v7, Tailwind CSS 3.4 | Responsive Single Page Application with dynamic role views |
| **GIS & Visualization** | Leaflet, React-Leaflet, Recharts, Lucide React | Interactive satellite mapping, polygon tracing, and analytics |
| **Backend API** | Node.js, Express 5, Express-Session, Helmet.js | RESTful API server with security middlewares and rate limiting |
| **Database** | MySQL2 (Connection Pooling), MySQL 8 | Relational database with full transaction isolation |
| **Cloud Hosting** | Render (Frontend SPA & Backend Web Service) | Continuous deployment, automated TLS/SSL, and cloud host runtime |
| **Cloud Database** | Aiven Cloud MySQL (SSL Mode Required) | Managed high-availability cloud database with SSL encryption |
| **Communications** | Brevo HTTPS REST API (Transactional Email) | Automated customer inquiry confirmations, receipts, and OTPs |
| **Real-Time Alerts** | Meta Graph API (Facebook Messenger) | Direct push notifications to broker/developer for instant lead alerts |
| **State & Caching** | TanStack React Query v5 | Automatic background refetching and client cache management |
| **DevOps & Containers** | Docker, Docker Compose, phpMyAdmin | Containerized development environment with local DB administration |
| **Security & Auth** | JWT (`jsonwebtoken`), `bcryptjs`, DOMPurify | Cryptographic token signing, password hashing, XSS sanitization |

---

## Repository Structure

```text
.
├── back-end/
│   ├── config/             # Database connection pool & system state
│   ├── scripts/            # Database export & Aiven Cloud Sync tools
│   └── src/
│       ├── app.js          # Express app with security middlewares
│       ├── server.js       # HTTP server bootstrapper
│       ├── controllers/    # Business logic (Lots, Properties, Customers, Auth, Transactions)
│       ├── routes/         # API endpoints with rate limiters & developer routes
│       ├── middleware/     # Auth, session, maintenance & sanitization
│       ├── services/       # Brevo email service, Messenger alerts & session manager
│       └── utils/          # OWASP XSS sanitizer & geocoding helpers
├── front-end/
│   ├── public/             # PWA Manifest, Service Worker & Icons
│   └── src/
│       ├── components/     # UI components (Admin, Employee, Header, Map, Modals)
│       ├── pages/          # Admin, Employee, Developer Panel, Login, Maps
│       └── utils/          # Geocoding engine & coordinate helpers
├── database_Backup/        # Master SQL dump (00_FULL_BACKUP.sql) & table files
├── docker-compose.yml
└── package.json            # Monorepo root scripts
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js:** v20+ LTS
- **npm:** v9+
- **MySQL:** Laragon or MySQL 8.0+

### 2. Installation
Clone the repository and install all monorepo dependencies:

```bash
git clone https://github.com/goldendragonestate/Digital-Lot-Tracker-System.git
cd Digital-Lot-Tracker-System
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
PORT=5000
SESSION_SECRET=golden_dragon_secure_session_key_2026
JWT_SECRET=golden_dragon_jwt_secret_key_2026

# Local Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=golden_dragon_corp

# Frontend Client Origin
FRONTEND_URL=http://localhost:3000

# Transactional Email Engine (Brevo HTTPS REST API)
EMAIL_USER=goldendragonestate@gmail.com
BREVO_API_KEY=your_brevo_api_key_here

# Real-Time Broker Alerts (Meta Facebook Messenger Graph API)
FB_PAGE_ACCESS_TOKEN=your_facebook_page_access_token
FB_RECIPIENT_PSID=your_recipient_page_scoped_id
FB_VERIFY_TOKEN=golden_dragon_bot_2026

# Production Cloud Database (Aiven Cloud MySQL over SSL)
AIVEN_SERVICE_URI=mysql://avnadmin:YOUR_PASSWORD@YOUR_AIVEN_HOST:PORT/defaultdb?ssl-mode=REQUIRED

# Developer Diagnostics Gate
DEVELOPER_PIN=5551
```

### 4. Run Development Servers
Start both the Frontend and Backend concurrently with a single command:

```bash
npm run dev
```

- **Frontend Client:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/api/health`

---

## Database Synchronization (Laragon / Aiven Cloud)

Automated database migration and cloud synchronization scripts located in `back-end`:

```bash
# 1. Export local database to database_Backup/
npm --prefix back-end run db:export

# 2. Upload and sync backup directly to Aiven Cloud MySQL
npm --prefix back-end run db:sync-cloud
```

---

## Available NPM Scripts

| Command | Working Directory | Description |
| :--- | :--- | :--- |
| `npm run dev` | Root | Concurrently runs frontend (`:3000`) and backend (`:5000`) |
| `npm run build:front` | Root | Builds optimized production bundle in `front-end/build` |
| `npm run format` | Root | Formats repository source code with Prettier |
| `npm run dev` | `back-end/` | Runs Express server with Nodemon auto-reload |
| `npm run db:export` | `back-end/` | Dumps SQL backup of all 596 lots and associated tables |
| `npm run db:sync-cloud` | `back-end/` | Pushes local SQL snapshots to Aiven Cloud MySQL |
| `npm start` | `front-end/` | Launches React development server |
| `npm run build` | `front-end/` | Produces production-ready React client bundle |

---

## Docker Deployment (Optional)

Run the containerized platform stack with MySQL and phpMyAdmin:

```bash
docker compose up --build
```

- **Frontend Application:** `http://localhost:3000`
- **Backend Service:** `http://localhost:5000`
- **Database Administration (phpMyAdmin):** `http://localhost:8080`

---

## License

Distributed under the **MIT License**. Engineered for Golden Dragon Estate Corporation.
