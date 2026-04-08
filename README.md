# Golden Dragon Estate Platform

Full-stack estate lot management system for Golden Dragon Estate Corporation.

This repository includes a React frontend, an Express backend, MySQL database integration, and Docker support for local development.

## Core Scope

- Role-based authentication for admin and employee users
- Employee, property, lot, and customer management
- Lot map views and coordinate updates
- Profile management and password flows

## Tech Stack

- Frontend: React (CRA), React Router, Axios, React Query, React Leaflet
- Backend: Node.js, Express 5, MySQL2, express-session, JWT
- Database: MySQL 8
- Email: Nodemailer
- Monorepo: npm workspaces (`front-end`, `back-end`)

## Repository Layout

```text
.
|-- back-end/
|   |-- src/
|   |   |-- app.js
|   |   |-- server.js
|   |   |-- routes/
|   |   |-- controllers/
|   |   `-- middleware/
|   `-- config/
|-- front-end/
|   `-- src/
|       |-- App.jsx
|       |-- pages/
|       |-- components/
|       `-- view/
|-- database_Backup/
|-- docker-compose.yml
`-- package.json
```

## Prerequisites

- Node.js 20+
- npm 9+
- MySQL 8 (if not using Docker)
- Docker Desktop (optional)

## Environment Variables

Create `.env` in the repository root.

```env
PORT=5000
SESSION_SECRET=replace_with_secure_random_value
JWT_SECRET=replace_with_secure_random_value

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=golden_dragon_corp

EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email_user
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=no-reply@example.com
```

For Docker Compose, backend DB host is overridden to `db` automatically.

## Quick Start (Local)

1. Install dependencies from root:

```bash
npm install
```

1. Start frontend and backend together:

```bash
npm run dev
```

1. Open:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## Scripts

### Root

- `npm run dev` - Run backend and frontend concurrently
- `npm run build:front` - Build frontend from root
- `npm run format` - Format repository using Prettier
- `npm run format:check` - Check formatting

### Backend

- `npm --prefix back-end start` - Start API server
- `npm --prefix back-end run dev` - Start API with nodemon

### Frontend

- `npm --prefix front-end start` - Start React app
- `npm --prefix front-end build` - Build React app
- `npm --prefix front-end test` - Run frontend tests

## Docker (Optional)

Start all services:

```bash
docker compose up --build
```

Stop services:

```bash
docker compose down
```

Service URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- MySQL: `localhost:3306`
- phpMyAdmin: `http://localhost:8080`

## API Modules

Base URL: `http://localhost:5000`

- `/api/auth`
- `/api/employees`
- `/api/properties`
- `/api/lots`
- `/api/customers`
- `/api/admin`

Route definitions are in:

- `back-end/src/routes/authRoutes.js`
- `back-end/src/routes/employeeRoutes.js`
- `back-end/src/routes/propertyRoutes.js`
- `back-end/src/routes/lotRoutes.js`
- `back-end/src/routes/customerRoutes.js`
- `back-end/src/routes/adminRoutes.js`

## License

This project is licensed under the MIT License.
