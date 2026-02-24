-- ============================================================
-- PROPERTIES TABLE - Store property/subdivision information
-- ============================================================

CREATE TABLE IF NOT EXISTS `properties` (
  `property_id` INT NOT NULL AUTO_INCREMENT,
  `property_name` VARCHAR(255) NOT NULL,
  `location` TEXT NOT NULL,
  `description` TEXT,
  `total_lots` INT DEFAULT 0,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SAMPLE DATA 
-- ============================================================

INSERT INTO `properties` (`property_name`, `location`, `description`, `total_lots`, `status`) VALUES
('Golden Hills Subdivision', 'Brgy. San Jose, Iloilo City', 'Premium residential subdivision with complete amenities', 50, 'active'),
('Dragon View Estate', 'Brgy. Mandurriao, Iloilo City', 'Affordable housing with scenic mountain views', 30, 'active');
