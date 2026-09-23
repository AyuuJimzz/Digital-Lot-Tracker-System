-- Golden Dragon Corp Database Backup
-- Table: transactions
-- Generated on: 2026-09-23T18:47:59.843Z

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `transaction_date` datetime DEFAULT current_timestamp(),
  `payment_type` enum('Cash','Installment','No Downpayment','Bank Transfer','Online Payment') DEFAULT 'Cash',
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `employee_id` int(11) DEFAULT NULL,
  `is_demo` tinyint(1) DEFAULT 0,
  `agent_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `lot_id` (`lot_id`),
  KEY `customer_id` (`customer_id`),
  KEY `idx_transaction_date` (`transaction_date`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`lot_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=96 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
