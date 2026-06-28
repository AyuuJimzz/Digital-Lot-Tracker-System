USE golden_dragon_corp;

-- Add columns to admins table
ALTER TABLE `admins` 
ADD COLUMN `password_reset_required` BOOLEAN DEFAULT FALSE,
ADD COLUMN `temp_password_expiry` DATETIME NULL;

-- Add columns to employees table  
ALTER TABLE `employees`
ADD COLUMN `password_reset_required` BOOLEAN DEFAULT FALSE,
ADD COLUMN `temp_password_expiry` DATETIME NULL;
