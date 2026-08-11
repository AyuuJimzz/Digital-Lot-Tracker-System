# Lot Status Update and Email Notification System

## Overview

This system allows updating lot statuses and automatically sends reminder emails to customers when lots have been pending for more than 12 hours.

## Features Implemented

### 1. Lot Status Update API

- **Endpoint**: `PUT /api/lots/:id/status`
- **Request Body**: `{ "status": "Available|Pending|Sold" }`
- **Functionality**:
  - Updates lot status
  - Records timestamp when status changes to Pending
  - Clears pending timestamp when status changes from Pending

### 2. Email Notification System

- **Automatic**: Scheduled job runs every hour
- **Manual**: `POST /api/lots/send-pending-reminders`
- **Triggers**:
  - First email sent at 12 hours (friendly reminder)
  - Second email sent at 24 hours (final reminder with urgent tone)
- **Prevents duplicates**: Tracks when last reminder was sent

### 3. Database Schema Updates

Run the migration script: `back-end/migrations/add_pending_timestamps.sql`

- Adds `pending_since` DATETIME column
- Adds `last_reminder_sent` DATETIME column
- Creates index on `pending_since` for performance

## API Endpoints

### Update Lot Status

```http
PUT /api/lots/:id/status
Content-Type: application/json

{
  "status": "Pending"
}
```

### Send Pending Reminders (Manual)

```http
POST /api/lots/send-pending-reminders
```

## Environment Variables Required

Add these to your `.env` file:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=goldendragone23@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=Golden Dragon Estate Corporation <goldendragone23@gmail.com>
```

## Scheduled Job

- Runs automatically every hour at the top of the hour
- Logs results to console
- Handles errors gracefully

## Email Template

The system sends professional HTML emails with:

- Property and lot details
- Reservation date/time
- Call to action for customers
- Professional branding

## Usage Examples

### Frontend Integration

```javascript
// Update lot status
const updateStatus = async (lotId, newStatus) => {
  const response = await fetch(`/api/lots/${lotId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  });
  return response.json();
};

// Trigger reminder emails (admin only)
const sendReminders = async () => {
  const response = await fetch("/api/lots/send-pending-reminders", {
    method: "POST",
  });
  return response.json();
};
```

## Notes

- Email functionality requires valid SMTP configuration
- Scheduled job starts automatically when server starts
- Emails are only sent to customers with valid email addresses
- System prevents duplicate reminder emails
