-- Golden Dragon Corp Database Backup
-- Table: transactions
-- Generated on: 2026-09-01T18:39:54.906Z

DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `transaction_id` int NOT NULL AUTO_INCREMENT,
  `lot_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `transaction_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `payment_type` enum('Cash','Installment','No Downpayment','Bank Transfer','Online Payment') DEFAULT 'Cash',
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  KEY `lot_id` (`lot_id`),
  KEY `customer_id` (`customer_id`),
  KEY `idx_transaction_date` (`transaction_date`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`lot_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

