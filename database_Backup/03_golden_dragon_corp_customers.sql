-- Golden Dragon Corp Database Backup
-- Table: customers
-- Generated on: 2026-09-01T18:39:54.883Z

DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `lot_id` int NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `contact_number` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `address` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  KEY `lot_id` (`lot_id`),
  CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`lot_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

