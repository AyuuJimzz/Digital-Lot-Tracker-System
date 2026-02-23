# 🏢 Golden Dragon Estate Platform

**Digital Lot Tracking System - Capstone Project**

A comprehensive property and lot management system for Golden Dragon Estate Corporation, designed to streamline real estate sales, client management, and transaction tracking.

---

## 📑 Table of Contents

### ✅ Progress Tracking

- [Development Progress Checklist](#-development-progress-checklist)
  - [Phase 1: Core Features](#-phase-1-core-features-must-have)
  - [Phase 2: Advanced Features](#-phase-2-advanced-features)
  - [Phase 3: Nice to Have](#-phase-3-nice-to-have)

### 🎯 Planning & Features

- [Admin Features](#-admin-features)
  - [Employee Management](#employee-management)
  - [Property Management](#property-management)
  - [Lot Management](#lot-management)
  - [Client Management](#client-management)
  - [Transaction Management](#transaction-management)
  - [Payment Tracking](#payment-tracking)
  - [Reports](#reports)
  - [System Settings](#system-settings)
- [Employee Features](#-employee-features)
  - [Lot Viewing](#lot-viewing)
  - [Client Management](#client-management-1)
  - [Sales/Transaction](#salestransaction)
  - [Reports](#reports-1)

### 📋 System Details

- [Lot Management Details](#%EF%B8%8F-lot-management-details)
- [Client & Transaction Flow](#-client--transaction-flow)
- [Reports Needed](#-reports-needed)

### 🔄 Workflows

- [Admin User Flow](#admin-user-flow)
- [Employee User Flow](#employee-user-flow)
- [Lot Purchase Scenario](#-lot-purchase-scenario)

### 🎨 Design

- [Color Palette](#-color-palette)

---

## ✅ DEVELOPMENT PROGRESS CHECKLIST

### 📌 Phase 1: Core Features

#### Backend API Development

- [x] Employee CRUD APIs
  - [x] GET /api/employees - View all
  - [x] POST /api/employees - Add new
  - [x] PUT /api/employees/:id - Update
  - [x] DELETE /api/employees/:id - Delete
- [ ] Property CRUD APIs
  - [ ] GET /api/properties - View all
  - [ ] POST /api/properties - Add new
  - [ ] PUT /api/properties/:id - Update
  - [ ] DELETE /api/properties/:id - Delete
  - [ ] PATCH /api/properties/:id/status - Toggle status
- [ ] Lot CRUD APIs
  - [ ] GET /api/lots - View all lots
  - [ ] GET /api/lots/:propertyId - View lots by property
  - [ ] POST /api/lots - Add new lot
  - [ ] PUT /api/lots/:id - Update lot
  - [ ] DELETE /api/lots/:id - Delete lot
  - [ ] PATCH /api/lots/:id/status - Update lot status
- [ ] Client CRUD APIs
  - [ ] GET /api/clients - View all clients
  - [ ] POST /api/clients - Add new client
  - [ ] PUT /api/clients/:id - Update client
  - [ ] DELETE /api/clients/:id - Delete client
- [ ] Transaction APIs
  - [ ] POST /api/transactions - Record sale (cash only)
  - [ ] GET /api/transactions - View all transactions
  - [ ] GET /api/transactions/:id - View transaction details
- [ ] Basic Reports APIs
  - [ ] GET /api/reports/sales-summary - Total sales
  - [ ] GET /api/reports/lot-status - Available/Sold counts
  - [ ] GET /api/reports/employee-performance - Sales per employee

#### Frontend Pages (Admin)

- [x] Admin Dashboard
- [x] Manage Employees Page
  - [x] View all employees
  - [x] Add new employee form
  - [x] Edit employee form
  - [x] Delete employee
- [ ] Manage Properties Page
  - [ ] View all properties
  - [ ] Add new property form
  - [ ] Edit property form
  - [ ] Delete property
  - [ ] Toggle status (active/inactive)
- [ ] Manage Lots Page
  - [ ] View all lots (table/list view)
  - [ ] Filter by property
  - [ ] Filter by status
  - [ ] Add new lot form
  - [ ] Edit lot form
  - [ ] Delete lot
  - [ ] Update lot status
- [ ] Manage Clients Page
  - [ ] View all clients
  - [ ] Add new client form
  - [ ] Edit client form
  - [ ] View client purchase history
- [ ] Record Sale Page
  - [ ] Select client
  - [ ] Select available lot
  - [ ] Cash payment form
  - [ ] Generate receipt/confirmation
- [ ] Reports Page
  - [ ] Sales summary report
  - [ ] Lot status overview
  - [ ] Employee performance

#### Frontend Pages (Employee)

- [x] Employee Dashboard
- [ ] View Available Lots
  - [ ] List of available lots
  - [ ] Filter/search functionality
  - [ ] View lot details
- [ ] My Clients Page
  - [ ] View my client list
  - [ ] Add new client
  - [ ] Edit client info
- [ ] Record Sale Page
  - [ ] Select/add client
  - [ ] Select available lot
  - [ ] Cash payment form
- [ ] My Reports
  - [ ] My sales summary
  - [ ] My commission
  - [ ] My client list

#### Database Setup

- [x] employees table
- [x] admins table
- [ ] properties table
- [ ] lots table
- [ ] clients table
- [ ] transactions table
- [ ] payments table (basic for cash)

#### Authentication & Security

- [x] Session-based authentication
- [x] Admin/Employee role separation
- [x] Protected routes (middleware)
- [x] Access denied page
- [ ] Password hashing (bcrypt - currently commented out)

---

### 📌 Phase 2: Advanced Features

#### Payment System

- [ ] Installment payment tracking
  - [ ] Payment schedule generation
  - [ ] Record monthly payments
  - [ ] Calculate balance
  - [ ] Track overdue payments
- [ ] Payment reminders
  - [ ] Email notifications
  - [ ] SMS notifications (optional)
- [ ] Payment reports
  - [ ] Collection reports
  - [ ] Outstanding balance reports

#### Advanced Lot Management

- [ ] Map view for lots
  - [ ] Google Maps API integration
  - [ ] Visual lot layout
  - [ ] Interactive lot selection
- [ ] Bulk lot upload (CSV/Excel)
- [ ] Lot reservation system (temporary hold)
  - [ ] Set reservation expiry
  - [ ] Auto-release expired reservations

#### Advanced Reports

- [ ] Charts and graphs
  - [ ] Sales trends (monthly/quarterly)
  - [ ] Revenue analytics
  - [ ] Performance dashboards
- [ ] Export reports (PDF/Excel)
- [ ] Custom date range filters
- [ ] Advanced search and filtering

#### Notifications

- [ ] Email notifications
  - [ ] Sale confirmations
  - [ ] Payment due reminders
  - [ ] System announcements
- [ ] In-app notifications
  - [ ] Real-time updates
  - [ ] Notification center

---

### 📌 Phase 3: Optional

#### System Enhancements

- [ ] Audit logs
- [ ] Activity tracking
- [ ] Dark mode

---

### 📊 Overall Progress

**Phase 1:** 🟨 15% Complete (2/13 major features)

- ✅ Authentication System
- ✅ Employee Management
- ⏳ Property Management
- ⏳ Lot Management
- ⏳ Client Management
- ⏳ Transaction Recording (Cash)
- ⏳ Basic Reports

**Phase 2:** 🔲 0% Complete (Not started)

**Phase 3:** 🔲 0% Complete (Not started)

---

## 🔐 ADMIN FEATURES

### What can Admin do?

Check (✅) what features we need:

#### Employee Management

- [ ] View all employees
- [ ] Add new employee
- [ ] Edit employee info
- [ ] Delete employee

#### Property Management

- [ ] Add new property/subdivision
- [ ] Edit property details
- [ ] Delete property
- [ ] View all properties
- [ ] Set property status (active/inactive)

#### Lot Management

- [ ] View all lots (list/grid/map view)
- [ ] Add lots to property
- [ ] Edit lot details (size, price)
- [ ] Update lot status (Available, Reserved, Sold, Pending)
- [ ] Search/filter lots
- [ ] Bulk upload lots

#### Client Management

- [ ] View all clients
- [ ] Edit client info
- [ ] View client purchase history
- [ ] Search clients

#### Transaction Management

- [ ] View all transactions
- [ ] Approve/reject transactions
- [ ] View transaction details
- [ ] Cancel transactions

#### Payment Tracking

- [ ] View all payments
- [ ] View payment schedules
- [ ] Mark payments as received
- [ ] Track overdue payments

#### Reports

- [ ] Total sales report
- [ ] Sales per employee
- [ ] Available vs sold lots
- [ ] Monthly/quarterly reports
- [ ] Payment collection reports
- [ ] Export reports (PDF/Excel)

#### System Settings

- [ ] Manage system settings
- [ ] Set payment terms
- [ ] Configure email notifications

---

## 👤 EMPLOYEE FEATURES

### What can Employee do?

Check (✅) what features we need:

#### Lot Viewing

- [ ] View available lots
- [ ] View lot details (size, price, location)
- [ ] Search/filter lots
- [ ] Reserve lot for client (temporary hold)

#### Client Management

- [ ] Add new client
- [ ] Edit client info (their own clients only)
- [ ] View their client list
- [ ] Search clients

#### Sales/Transaction

- [ ] Record new sale
- [ ] Select lot for client
- [ ] Enter payment details (cash/installment)
- [ ] Generate receipt
- [ ] View transaction history (their sales only)

#### Reports

- [ ] View their own sales
- [ ] View their commission
- [ ] View their client list
- [ ] Download their reports

---

## 🏘️ LOT MANAGEMENT DETAILS

### How should lots work?

**Visual Display:**

- [ ] List view (table)
- [ ] Grid view (cards)
- [ ] Map view (visual layout)

**Lot Information:**

- [ ] Lot number
- [ ] Property/subdivision name
- [ ] Size (sqm)
- [ ] Price
- [ ] Status (Available, Reserved, Sold, Pending)
- [ ] Location within subdivision
- [ ] Dimensions (length x width)

**Lot Status:**

- [ ] **Available** - Ready to sell
- [ ] **Reserved** - Temporarily held for client (how many days?)
- [ ] **Pending** - Sale in process
- [ ] **Sold** - Already sold

**Features:**

- [ ] Filter by status
- [ ] Filter by property
- [ ] Filter by price range
- [ ] Search by lot number
- [ ] Sort by price/size

---

## 💰 CLIENT & TRANSACTION FLOW

### How to record a sale?

**Client Information Needed:**

```
- Full Name
- Contact Number
- Email
- Address
- Valid ID Type (Driver's License, Passport, etc.)
- Valid ID Number
```

**Transaction Information:**

```
- Selected Lot
- Sale Date
- Total Price
- Payment Type:
  [ ] Cash (full payment)
  [ ] Installment

If Installment:
- Down Payment Amount
- Monthly Payment Amount
- Payment Terms (how many months?)
- Payment Start Date
```

**Payment Tracking:**

- [ ] Record each payment
- [ ] Payment date
- [ ] Amount paid
- [ ] Balance remaining
- [ ] Payment method (cash, check, bank transfer)
- [ ] Receipt number

---

## 📊 REPORTS NEEDED

### What reports do we need?

Check (✅) reports needed:

**Admin Reports:**

- [ ] Total sales (all time, monthly, yearly)
- [ ] Sales per employee
- [ ] Available lots count
- [ ] Sold lots count
- [ ] Reserved lots count
- [ ] Total revenue
- [ ] Collection reports (payments received)
- [ ] Outstanding balance reports

**Employee Reports:**

- [ ] My sales (personal)
- [ ] My commission
- [ ] My clients
- [ ] My monthly performance

---

## 🔄 USER FLOWS

### ADMIN USER FLOW

**Login Flow:**

```
1. Open system → Login page
2. Enter email & password
3. System checks if Admin
4. Redirect to Admin Dashboard
5. See overview (stats, quick actions)
```

**Manage Employees Flow:**

```
1. Click "Manage Employees"
2. See list of all employees
3. Options:
   - Add New Employee → Fill form → Save
   - Edit Employee → Update info → Save
   - View Employee Details → See sales, clients
   - Delete Employee → Confirm → Remove
```

**Add Property Flow:**

```
1. Click "Add Property"
2. Fill form:
   - Property Name
   - Location
   - Total Lots
   - Description
3. Save Property
4. Add Lots to Property:
   - Lot Number
   - Size (sqm)
   - Price
   - Dimensions
5. Save Lots
```

**View Lots Flow:**

```
1. Click "View Lots"
2. See all lots (can switch view: List/Grid/Map)
3. Filter by:
   - Property
   - Status
   - Price range
4. Click lot → View details
5. Update status if needed
```

**View Reports Flow:**

```
1. Click "Reports"
2. Select report type
3. Select date range
4. Generate report
5. View on screen
6. Download (PDF/Excel)
```

---

### EMPLOYEE USER FLOW

**Login Flow:**

```
1. Open system → Login page
2. Enter email & password
3. System checks if Employee
4. Redirect to Employee Dashboard
5. See personal stats (my sales, my clients, available lots)
```

**View Available Lots Flow:**

```
1. Click "View Available Lots"
2. See all available lots
3. Filter/search lots
4. Click lot → View details
5. Reserve for client (if needed)
```

**Add Client Flow:**

```
1. Click "Add Client"
2. Fill client form:
   - Full name
   - Contact number
   - Email
   - Address
   - Valid ID info
3. Save client
```

**Record Sale Flow:**

```
1. Click "Record Sale"
2. Select/Add Client
3. Select Available Lot
4. Enter sale details:
   - Sale date
   - Total price (auto from lot)
   - Payment type (Cash/Installment)

   If Installment:
   - Down payment amount
   - Monthly payment
   - Number of months
   - Start date

5. Review details
6. Confirm sale
7. System:
   - Creates transaction
   - Updates lot status to "Sold"
   - Records payment (downpayment or full)
   - Generates receipt
8. Print/Download receipt
```

---

## 🏢 LOT PURCHASE SCENARIO

### Real-world example / Tun-an nga hitabo:

**Scenario: Client Buying a Lot**

```
1. CLIENT VISITS OFFICE
   - Employee welcomes client

2. SHOW AVAILABLE LOTS
   - Employee opens "View Available Lots"
   - Shows client different options
   - Filters by price/location if needed

3. CLIENT CHOOSES LOT
   - Employee clicks on chosen lot
   - Shows full details (size, price, location)
   - Can reserve temporarily if client needs time to decide

4. CLIENT DECIDES TO BUY
   - Employee clicks "Record Sale"
   - Selects/Adds client info
   - Selects the lot
   - Client chooses payment:

     Option A: FULL CASH PAYMENT
     - Enter full amount
     - System marks as "Sold"
     - Generate receipt

     Option B: INSTALLMENT
     - Enter down payment (example: 20%)
     - Set monthly payment amount
     - Set payment terms (24 months, 36 months, etc.)
     - System marks as "Sold" (with balance)
     - Generate receipt for down payment

5. SYSTEM UPDATES
   - Lot status: Available → Sold
   - Creates transaction record
   - Records payment
   - Assigns to employee (commission tracking)

6. RECEIPT/DOCUMENTS
   - Generate official receipt
   - Print/Email to client
   - Save in system

7. PAYMENT TRACKING (if installment)
   - Client pays monthly
   - Employee records each payment
   - System tracks balance
   - Sends reminders for due payments
```

---

## 🎨 Color Palette

### Primary Colors

```css
--primary-gold: #b8860b; /* Golden Dragon main color */
--primary-dark: #8b6914; /* Darker gold for hover states */
--primary-light: #daa520; /* Light gold for highlights */
```

### Neutral Colors

```css
--neutral-white: #ffffff; /* Backgrounds, cards */
--neutral-light: #f5f5f5; /* Light backgrounds */
--neutral-gray: #e0e0e0; /* Borders, dividers */
--neutral-dark: #424242; /* Text, headings */
--neutral-black: #1a1a1a; /* Primary text */
```

### Status Colors (for Lot Tracking)

```css
--status-available: #4caf50; /* Green - Available lots */
--status-pending: #ffc107; /* Yellow/Amber - Pending */
--status-sold: #f44336; /* Red - Sold */
--status-reserved: #ff9800; /* Orange - Reserved */
```

### UI Colors

```css
--success: #28a745;
--error: #dc3545;
--warning: #ffc107;
--info: #17a2b8;
```
