-- Golden Dragon Corp Database Backup
-- Table: sale_date_audit
-- Generated on: 2026-10-19T13:44:53.434Z

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `sale_date_audit` WRITE;
/*!40000 ALTER TABLE `sale_date_audit` DISABLE KEYS */;
INSERT INTO `sale_date_audit` (`audit_id`, `lot_id`, `transaction_id`, `action`, `previous_sold_on`, `new_sold_on`, `previous_transaction_date`, `new_transaction_date`, `previous_is_date_verified`, `new_is_date_verified`, `previous_date_provenance`, `new_date_provenance`, `changed_by_role`, `changed_by_user_id`, `changed_by_email`, `changed_at`) VALUES
  (1, 7870, 404, 'mark_undated', '2026-10-19', NULL, '2026-10-19 04:44:27.000000', '2026-10-19 04:44:27.000000', 0, 0, 'unknown_requires_review', 'unknown_requires_review', 'admin', 2, 'admin@gmail.com', '2026-10-19 21:01:06'),
  (2, 7869, 403, 'mark_undated', '2026-10-19', NULL, '2026-10-19 04:43:55.000000', '2026-10-19 04:43:55.000000', 0, 0, 'unknown_requires_review', 'unknown_requires_review', 'admin', 2, 'admin@gmail.com', '2026-10-19 21:01:12'),
  (3, 7962, 405, 'mark_undated', '2026-10-19', NULL, '2026-10-19 04:44:59.000000', '2026-10-19 04:44:59.000000', 0, 0, 'unknown_requires_review', 'unknown_requires_review', 'admin', 2, 'admin@gmail.com', '2026-10-19 21:01:18'),
  (4, 7961, 406, 'mark_undated', '2026-10-19', NULL, '2026-10-19 04:45:19.000000', '2026-10-19 04:45:19.000000', 0, 0, 'unknown_requires_review', 'unknown_requires_review', 'admin', 2, 'admin@gmail.com', '2026-10-19 21:01:24'),
  (5, 7871, 407, 'mark_undated', '2026-10-19', NULL, '2026-10-19 04:45:33.000000', '2026-10-19 04:45:33.000000', 0, 0, 'unknown_requires_review', 'unknown_requires_review', 'admin', 2, 'admin@gmail.com', '2026-10-19 21:01:30');
/*!40000 ALTER TABLE `sale_date_audit` ENABLE KEYS */;
UNLOCK TABLES;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
