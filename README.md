# 🐉 Golden Dragon Estate Platform

> **Modern, Full-Stack Digital Lot Tracking & Subdivision GIS Mapping System**  
> Built for Golden Dragon Estate Corporation to streamline real estate lot inventory, interactive satellite mapping, customer reservations, and estate transactions.

---

## 🌟 Key System Capabilities

### 🗺️ 1. Interactive GIS & Satellite Estate Mapping
- **590+ GPS-Georeferenced Lots:** High-precision interactive subdivision polygons across Oton, Guimbal, and surrounding estates.
- **Smart Road Label Annotations:** Transparent, geo-anchored road width and street name text labels with deep-zoom auto-filtering.
- **Dynamic Property Switching:** Instant swipe & flyTo navigation between subdivisions with real-time LGU coordinates.
- **Hardware-Accelerated Zoom:** 60 FPS smooth rendering with zero DOM node churn and debounced camera state tracking.

### 📐 2. CAD & Blueprint Site Tracing Tools (Admin)
- **Blueprint Image Overlay:** Upload official CAD site plans and overlay them onto live satellite maps with adjustable opacity, scale, and rotation.
- **Magnetic Polygon Tracing:** Snap vertices directly to blueprint boundaries with automatic square-meter area calculation.
- **Bulk Shifting & Calibration:** Fine-tune entire block coordinates with magnetic compass controls.

### 🛡️ 3. OWASP Hardened Security Architecture
- **Strict Brute-Force Shield:** Maximum 5 failed login attempts per 15-minute window with smart `skipSuccessfulRequests`.
- **Global XSS & Script Sanitizer:** Automated cleaning of customer inputs, addresses, and transaction notes.
- **Secure Authentication:** `bcryptjs` password hashing, `httpOnly` session cookies, and JWT token support for cross-origin deployments.
- **Messenger Health Alert Bot:** Automated real-time alerts dispatched via Facebook Messenger Webhooks on database drops or latency spikes.

### 📱 4. PWA (Progressive Web App) & Offline Resilience
- **Site-Tripping Tablet Ready:** Standalone landscape fullscreen mode for agents presenting in the field.
- **Offline 43-LGU Geocoding Engine:** In-memory fallback coordinates covering all municipalities across Iloilo, Guimaras, and Panay.
- **Service Worker (`sw.js`):** Fast asset caching for sub-500ms initial load times.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18 (CRA), React Leaflet, Lucide Icons, Axios, PWA Service Worker |
| **Backend** | Node.js, Express 5, MySQL2 (Connection Pooling), Helmet.js, Rate-Limit, Session |
| **Database** | MySQL 8 (Local Laragon / Docker) & **Aiven Cloud MySQL** (Production) |
| **Styling** | Vanilla CSS Design System with Tailwind Utilities & CSS Hardware Acceleration |
| **Hosting** | Render (Web Service Backend & Static Site Frontend) |

---

## 📁 Repository Structure

```text
.
├── back-end/
│   ├── config/             # Database connection pool & system state
│   ├── scripts/            # Database export & Aiven Cloud Sync tools
│   └── src/
│       ├── app.js          # Express app with security middlewares
│       ├── server.js       # HTTP server bootstrapper
│       ├── controllers/    # Business logic (Lots, Properties, Customers, Auth)
│       ├── routes/         # API endpoints with rate limiters
│       ├── middleware/     # Auth, session, maintenance & sanitization
│       ├── services/       # Messenger alerts & DB backup service
│       └── utils/          # OWASP XSS sanitizer utility
├── front-end/
│   ├── public/             # PWA Manifest, Service Worker & Icons
│   └── src/
│       ├── components/     # UI components (Admin, Employee, Header, Map)
│       ├── pages/          # Dashboard, AdminViewMap, EmployeeMapView, Login
│       └── utils/          # Geocoding engine & coordinate helpers
├── database_Backup/        # Master SQL dump (00_FULL_BACKUP.sql) & table files
├── docker-compose.yml
└── package.json            # Monorepo scripts
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js:** v20+
- **npm:** v9+
- **MySQL:** Laragon or MySQL 8

### 2. Installation
Clone the repository and install all root and workspace dependencies:

```bash
git clone https://github.com/AyuuJimzz/Digital-Lot-Tracker-System.git
cd Digital-Lot-Tracker-System
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:

```env
PORT=5000
SESSION_SECRET=golden_dragon_secure_session_key_2026
JWT_SECRET=golden_dragon_jwt_secret_key_2026

# Local Database (Laragon)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=golden_dragon_corp

# Optional: Aiven Cloud Sync URI
AIVEN_SERVICE_URI=mysql://avnadmin:YOUR_PASSWORD@YOUR_AIVEN_HOST:PORT/defaultdb?ssl-mode=REQUIRED
```

### 4. Run Locally
Start both Frontend and Backend concurrently with 1 command:

```bash
npm run dev
```

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## ☁️ Database Synchronization (Laragon ⇄ Aiven Cloud)

We provide 1-command database export and cloud synchronization scripts in `back-end`:

```bash
# 1. Export local Laragon DB to database_Backup/
npm --prefix back-end run db:export

# 2. Upload & sync to live Aiven Cloud MySQL
npm --prefix back-end run db:sync-cloud
```

---

## 📜 Available NPM Scripts

### Monorepo Root
- `npm run dev` — Concurrently run frontend (`:3000`) and backend (`:5000`)
- `npm run build:front` — Build optimized React production bundle
- `npm run format` — Format code using Prettier

### Backend (`back-end/`)
- `npm run dev` — Run Express server with Nodemon auto-restart
- `npm run db:export` — Dump clean SQL backups of all 596 lots and tables
- `npm run db:sync-cloud` — Synchronize database backups directly to Aiven Cloud

### Frontend (`front-end/`)
- `npm start` — Run React development server
- `npm run build` — Create compressed production build (~330 KB gzipped)

---

## 🐳 Docker Deployment (Optional)

Run the full platform with MySQL and phpMyAdmin:

```bash
docker compose up --build
```

- **Frontend:** `http://localhost:3000`
- **Backend:** `http://localhost:5000`
- **phpMyAdmin:** `http://localhost:8080`

---

## ⚖️ License

Distributed under the **MIT License**. Created for Golden Dragon Estate Corporation.
