# 🏢 Golden Dragon Estate Platform

**Digital Lot Tracking System - Capstone Project**

A comprehensive property and lot management system for Golden Dragon Estate Corporation, designed to streamline real estate sales, client management, and transaction tracking.

---

## 📑 Table of Contents

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
