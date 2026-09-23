<div align="center">

<img src="front-end/src/assets/image/golden-dragon-logo.png" alt="Golden Dragon Estate Logo" width="100" style="border-radius: 50%;" />

# Golden Dragon Estate Platform

**Enterprise GIS Subdivision Mapping & Digital Real Estate Management System**

An end-to-end full-stack platform engineered for real estate developers and brokers to manage subdivision inventories, interactive satellite GIS mapping, automated CAD blueprint ingestion, agent sales pipelines, and customer reservations.

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Leaflet](https://img.shields.io/badge/GIS-Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MySQL](https://img.shields.io/badge/Database-MySQL_8-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Aiven Cloud](https://img.shields.io/badge/Cloud_DB-Aiven_MySQL-FF3E00?style=flat-square&logo=aiven&logoColor=white)](https://aiven.io/)
[![Render](https://img.shields.io/badge/Hosting-Render-46E3B7?style=flat-square&logo=render&logoColor=black)](https://render.com/)
[![UptimeRobot](https://img.shields.io/badge/Uptime-100%25_UptimeRobot-3BD671?style=flat-square&logo=uptimerobot&logoColor=white)](https://uptimerobot.com)
[![Brevo](https://img.shields.io/badge/Email_API-Brevo-0B996F?style=flat-square&logo=brevo&logoColor=white)](https://www.brevo.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br />

[**🌐 Explore Live Platform — goldendragonestate.onrender.com**](https://goldendragonestate.onrender.com)

</div>

---

## 🌟 Key Features

### 🗺️ Interactive GIS & Subdivision Map (UI & UX)
- **Cinematic Smooth Wheel Zoom**: Fluid, cursor-anchored zoom navigation delivering a continuous 60 FPS experience across large subdivision maps.
- **Dynamic Map Style Switching**: Smooth cross-fade visual transitions when toggling between Satellite, Street Map, and Hybrid views.
- **Real-Time Color-Coded Lot Inventory**: Instant visual inventory tracking: `Available` (Green), `Pending` (Gold), `Sold` (Red), and `Cancelled` (Purple).
- **Interactive Lot Selection & Tooltips**: Instant parcel hover glows, lot metadata tooltips, and smooth camera fly-to centering upon selection.
- **Interactive Multi-Lot Bulk Shift**: Visual drag-and-move tool enabling administrators to translate clusters of lots and annotations across the map with live bounding box preview.
- **Road & Street Geo-Labels**: Transparent, geo-anchored street names and road width markers that automatically adapt to zoom levels.

### 📐 CAD Blueprint & Vector PDF Tools (UI & UX)
- **Automated Blueprint PDF Ingestion**: Upload subdivision engineering PDFs and let the system automatically extract lot parcels, numbers, and boundaries.
- **Smart Survey Boundary Cutout (Auto-Crop)**: Automatically isolates estate lots while masking out title blocks, legends, and non-saleable survey margins.
- **Visual Vector Shape Editor**: Precision CAD drawing canvas with draggable corner vertices, midpoint `+` handles for adding points, double-click corner deletion, and keyboard nudges.
- **Visual Satellite Blueprint Overlay**: Live tracing paper overlay on satellite imagery with amber corner rotation handles, 4-way translation tool, opacity slider, and custom line styles (Lime, Cyan, Yellow, White).

### 💼 Sales CRM & Administrative Workflow
- **Slide-Out Lot Reservation Drawer**: Sleek right-side offcanvas panel displaying complete lot dimensions, pricing calculations, buyer info, and reservation actions.
- **Agent Sales Dashboard**: Dedicated agent portals (`My Sales`, `My Clients`) for tracking reservation deposits, client profiles, and payment milestones.
- **Role-Based Portals**: Tailored workflows and navigation layouts for Administrators, Brokers, and Sales Employees.
- **Clean Feedback Notifications**: Modern, unobtrusive toast notifications for status updates, lot saves, and system alerts.

### 📱 Modern Platform & Cloud Architecture
- **PWA & Field Tablet Ready**: Responsive design optimized for mobile and field tablets with home screen installation support.
- **Dual Authentication Security**: Secure 30-day persistent sessions, Bearer JWT protection, and role-based route guards.
- **Transactional Email**: Customer reservation receipts via Brevo email.
- **24/7 Zero-Downtime Availability**: Automated synthetic heartbeat keeping cloud services active with zero cold-start delays.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | React 18, React Router v7, Tailwind CSS | Modern Single Page Application with PWA offline shell |
| **GIS & Mapping** | Leaflet, React-Leaflet, Recharts, Lucide | Hardware-accelerated vector mapping and sales analytics |
| **Backend API** | Node.js, Express 5, Express-Session | RESTful micro-architecture with strict input sanitization |
| **Database** | MySQL 8, MySQL2 Connection Pool | High-performance relational database with ACID compliance |
| **Cloud Hosting** | Render (Static Frontend & Web Service Backend) | Automated CI/CD deployment with free TLS/SSL certificates |
| **Cloud Database** | Aiven Cloud MySQL | High-availability cloud-managed database with SSL encryption |
| **Communications** | Brevo API | Automated email receipts |
| **Monitoring** | UptimeRobot (24/7 Heartbeat) | Synthetic monitoring with active database ping |

---

## 📁 Repository Structure

```text
.
├── back-end/
│   ├── config/             # Database connection pool & system state
│   ├── scripts/            # Database export & Aiven Cloud sync utilities
│   └── src/
│       ├── app.js          # Express application & security middlewares
│       ├── server.js       # HTTP server bootstrapper
│       ├── controllers/    # Domain business logic (Lots, Properties, Customers, Auth)
│       ├── routes/         # Declarative API routers & route guards
│       ├── middleware/     # Auth, session, maintenance & sanitization
│       ├── services/       # Email delivery & session manager
│       └── utils/          # Geocoding helpers & input sanitizers
├── front-end/
│   ├── public/             # PWA Manifest, Service Worker & branding assets
│   └── src/
│       ├── components/     # Reusable UI component suites (Admin, Employee, Map, Modals)
│       ├── pages/          # Admin portal, Employee portal, Developer Console, Map views
│       └── utils/          # Geocoding engine & map projection helpers
├── database_Backup/        # Local database snapshots (ignored by Git)
├── docker-compose.yml      # Local containerized development stack
└── package.json            # Monorepo scripts
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js:** v20+ LTS
- **npm:** v9+
- **MySQL:** Laragon or MySQL 8.0+

### 2. Clone & Install
```bash
git clone https://github.com/goldendragonestate/Digital-Lot-Tracker-System.git
cd Digital-Lot-Tracker-System
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:

```env
PORT=5000
SESSION_SECRET=your_secure_session_secret
JWT_SECRET=your_jwt_secret_key

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
BREVO_API_KEY=your_brevo_api_key

# Production Cloud Database (Aiven Cloud MySQL over SSL)
AIVEN_SERVICE_URI=mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED
```

### 4. Run Development Servers
Start both the Frontend and Backend concurrently:

```bash
npm run dev
```

- **Frontend Client:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`
- **System Health:** `http://localhost:5000/api/health`

---

## 📄 License

Distributed under the **MIT License**. Engineered for **Golden Dragon Estate Corporation**.
