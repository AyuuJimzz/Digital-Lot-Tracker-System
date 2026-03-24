-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  client_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  contact_number VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  valid_id_type VARCHAR(100),
  valid_id_number VARCHAR(100),
  created_by INT,         -- employee_id who added this client
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
