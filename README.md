# 🐉 Golden Dragon Estate Platform

> **Modern, Full-Stack Digital Lot Tracking, Subdivision GIS Mapping & Estate Sales System**  
> Built for Golden Dragon Estate Corporation to streamline real estate lot inventory, interactive satellite mapping, customer reservations, and estate transactions.

---

## 🌟 Key System Capabilities

### 🗺️ 1. Interactive GIS & Satellite Estate Mapping
- **596+ GPS-Georeferenced Lots:** High-precision interactive subdivision polygons across Oton, Guimbal, and surrounding estates.
- **CAD & Blueprint Tracing (Admin):** Overlay official CAD subdivision blueprints onto live satellite imagery with adjustable opacity, scale, and rotation.
- **Smart Road Label Annotations:** Transparent, geo-anchored road width and street name text labels with deep-zoom auto-filtering.
- **Dynamic Property Switching:** Instant flyTo navigation between subdivisions with real-time LGU coordinates.
- **Hardware-Accelerated Zoom:** 60 FPS smooth rendering with zero DOM node churn and debounced camera state tracking.

### 💼 2. Real Estate CRM & Transaction Pipeline
- **Scoped Sales Pipeline (My Sales):** Employees track their personal active reservations (`Pending`) and completed deals (`Sold`) with live area and payment terms.
- **Complete Client History (My Clients):** Full CRM contact directory recording customer details, lot assignments, and past cancellation history.
- **Unified Color-Coded Status System:**
  - 🟢 **Available:** Green (`#16a34a` / `#4ade80`) — ready for client inquiries and reservation.
  - 🟡 **Pending:** Warm Amber / Gold (`#f59e0b` / `#fbbf24`) — active client reservation pending verification.
  - 🔴 **Sold:** Crimson Red (`#dc2626` / `#f87171`) — completed purchase with payment recorded.
  - 🟣 **Cancelled:** Purple Violet (`#a855f7` / `#c084fc`) — voided or cancelled inquiries.
- **Clean Typography Design:** Modern, unboxed data columns for smooth scannability and symmetric table alignment.

### 🛠️ 3. Developer Diagnostics & Storage Inspector
- **Live Database Table Inspector:** Real-time breakdown of managed tables, row counts, and relative storage disk footprint.
- **Transactional Email Integration:** Native Brevo HTTPS REST API integration for automated email delivery and client notifications (300 free daily sends).
- **Demo Data Engine:** Realistic presentation generator for demo buyers, payment methods (Cash, Installment, No Downpayment), and status distributions.
- **Audit Logging & Activity Tracking:** Real-time logging of logins, lot status updates, maintenance triggers, and system events.

### 🛡️ 4. OWASP Hardened Security Architecture
- **Strict Brute-Force Shield:** Maximum 5 failed login attempts per 15-minute window with smart `skipSuccessfulRequests`.
- **Global XSS & Script Sanitizer:** Automated DOMPurify and OWASP script stripping on all customer inputs, addresses, and transaction notes.
- **Multi-Auth Architecture:** `bcryptjs` password hashing, secure `httpOnly` session cookies, and bearer JWT token support.
- **Emergency Maintenance Mode:** One-click global maintenance toggle and database protection kill switch.

### 📱 5. PWA (Progressive Web App) & Offline Resilience
- **Site-Tripping Tablet Ready:** Standalone landscape fullscreen mode optimized for real estate agents presenting in the field.
- **Offline 43-LGU Geocoding Engine:** In-memory fallback coordinates covering all municipalities across Iloilo, Guimaras, and Panay.
- **Service Worker (`sw.js`):** Optimized asset caching with sub-second repeat load times.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, React Leaflet, Lucide Icons, Axios, Tailwind CSS, PWA Service Worker |
| **Backend** | Node.js, Express 5, MySQL2 (Connection Pooling), Helmet.js, Express-Rate-Limit, Express-Session |
| **Database** | MySQL 8 (Local Laragon / Docker) & **Aiven Cloud MySQL** (Production) |
| **Email Service** | **Brevo HTTPS REST API** (Transactional Emails) |
| **Styling** | Vanilla CSS Design System with Tailwind Utilities & CSS Hardware Acceleration |
| **Deployment** | Render (Web Service Backend & Static Site Frontend) |

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

# Optional: Brevo Email API
BREVO_API_KEY=your_brevo_api_key_here

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

1-command database export and cloud synchronization scripts in `back-end`:

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
