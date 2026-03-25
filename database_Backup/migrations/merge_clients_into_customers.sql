-- Merge client fields into customers table
ALTER TABLE customers
ADD COLUMN full_name VARCHAR(255) DEFAULT NULL AFTER email,
ADD COLUMN contact_number VARCHAR(50) DEFAULT NULL AFTER full_name,
ADD COLUMN address TEXT DEFAULT NULL AFTER contact_number;

-- Change primary key from composite (customer_id, lot_id) to customer_id only
-- Then make lot_id nullable (allows clients without lot reservation)
ALTER TABLE customers
DROP PRIMARY KEY,
ADD PRIMARY KEY (customer_id),
MODIFY COLUMN lot_id INT DEFAULT NULL;

-- Drop the clients table (no longer needed)
DROP TABLE IF EXISTS clients;
