-- Golden Dragon Corp Database Backup
-- Table: sale_date_audit
-- Generated on: 2026-10-15T04:23:42.648Z

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;
DROP TABLE IF EXISTS `sale_date_audit`;
CREATE TABLE `sale_date_audit` (
  `audit_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `lot_id` bigint(20) NOT NULL,
  `transaction_id` bigint(20) DEFAULT NULL,
  `action` varchar(30) NOT NULL,
  `previous_sold_on` varchar(10) DEFAULT NULL,
  `new_sold_on` varchar(10) DEFAULT NULL,
  `previous_transaction_date` varchar(32) DEFAULT NULL,
  `new_transaction_date` varchar(32) DEFAULT NULL,
  `previous_is_date_verified` tinyint(1) DEFAULT NULL,
  `new_is_date_verified` tinyint(1) NOT NULL,
  `previous_date_provenance` varchar(50) DEFAULT NULL,
  `new_date_provenance` varchar(50) NOT NULL,
  `changed_by_role` varchar(20) NOT NULL,
  `changed_by_user_id` bigint(20) DEFAULT NULL,
  `changed_by_email` varchar(255) DEFAULT NULL,
  `changed_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`audit_id`),
  KEY `idx_sale_date_audit_lot` (`lot_id`,`audit_id`),
  KEY `idx_sale_date_audit_transaction` (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
