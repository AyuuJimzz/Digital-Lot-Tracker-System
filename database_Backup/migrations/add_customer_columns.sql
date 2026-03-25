-- Add customer information columns to existing customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS address TEXT NOT NULL;
