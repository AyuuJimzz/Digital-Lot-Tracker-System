-- Golden Dragon Corp Database Backup
-- Table: employees
-- Generated on: 2026-10-15T04:23:42.630Z

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `employee_id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `password` varchar(150) DEFAULT NULL,
  `password_reset_required` tinyint(1) DEFAULT 0,
  `temp_password_expiry` datetime DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `active_session_id` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`employee_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` (`employee_id`, `first_name`, `last_name`, `email`, `password`, `password_reset_required`, `temp_password_expiry`, `status`, `last_login`, `created_at`, `active_session_id`) VALUES
  (13, 'Sarah Mae', 'Santos', 'sarah.santos@goldendragon.com', '$2b$10$oB0mUDbmGo/LXEDussTf5.862Cwiin1B9IbZwAtEDVc5ner8ZlZkq', 0, NULL, 'active', '2026-10-15 11:41:25', '2026-09-16 04:54:34', NULL),
  (19, 'Mark Anthony', 'Reyes', 'mark.reyes@goldendragon.com', '$2b$10$CHuKP7WNk6fW2pMOvp6umeZkZlgs.mLKPA5ELgyKJ4JsTc5dvjcqe', 0, NULL, 'active', '2026-10-03 18:28:57', '2026-09-26 13:28:53', NULL);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
