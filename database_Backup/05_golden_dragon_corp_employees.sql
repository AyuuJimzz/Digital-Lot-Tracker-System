-- Golden Dragon Corp Database Backup
-- Table: employees
-- Generated on: 2026-09-01T18:39:54.887Z

DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `employee_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `password` varchar(150) DEFAULT NULL,
  `password_reset_required` tinyint(1) DEFAULT '0',
  `temp_password_expiry` datetime DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` (`employee_id`, `first_name`, `last_name`, `email`, `password`, `password_reset_required`, `temp_password_expiry`, `status`, `last_login`, `created_at`) VALUES
  (1, 'james', 'delos santos', 'jamesdelossantos1028@gmail.com', '$2b$10$K6vblrnIP1B6SthMyHy8Uu39CS/Lg1gR76S/eJf1LGhc54FdZHF0S', 0, NULL, 'active', '2026-09-01 21:09:01', '2026-08-31 18:03:07'),
  (7, 'John Edward', 'Bearneza', 'joan.bearneza.ui@phinmaed.com', '$2b$10$Kuw/JBnoiLgb3RE3vzmV1.78XUFvOgWSrpEzEbTWNa9Ltq3R6a3xa', 0, NULL, 'active', '2026-09-02 02:38:38', '2026-09-02 02:24:49');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;
