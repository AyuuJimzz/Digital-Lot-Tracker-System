-- Golden Dragon Corp Database Backup
-- Table: admins
-- Generated on: 2026-10-15T04:23:42.618Z

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;
DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `admin_id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(200) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `password_reset_required` tinyint(1) DEFAULT 0,
  `temp_password_expiry` datetime DEFAULT NULL,
  `active_session_id` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` (`admin_id`, `email`, `password`, `full_name`, `created_at`, `password_reset_required`, `temp_password_expiry`, `active_session_id`) VALUES
  (2, 'admin@gmail.com', '$2b$10$tItB.AA02Ln7W7muEmm4wOY4o5sgFZ/th7FHxbRRn0IdOi5dpI1ri', 'My Admin', '2026-02-18 03:37:20', 0, NULL, '7856b7bb-d92e-4bf0-bd7f-0b94eb992c93');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
