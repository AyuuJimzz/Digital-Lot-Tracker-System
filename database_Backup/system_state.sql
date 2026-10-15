-- Golden Dragon Corp Database Backup
-- Table: system_state
-- Generated on: 2026-10-15T04:23:42.651Z

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;
DROP TABLE IF EXISTS `system_state`;
CREATE TABLE `system_state` (
  `state_key` varchar(100) NOT NULL,
  `state_value` longtext NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

LOCK TABLES `system_state` WRITE;
/*!40000 ALTER TABLE `system_state` DISABLE KEYS */;
INSERT INTO `system_state` (`state_key`, `state_value`, `updated_at`) VALUES
  ('non_saleable_manual_exclusions', '[]', '2026-09-27 00:28:30'),
  ('non_saleable_migration_meta', '{"executed_at":"2026-10-03T11:24:35.381Z","completed_without_conflicts":true,"total_parcels":596,"candidate_count":22,"flagged_count":22,"skipped_exclusions":[],"preflight_conflicts_count":0,"write_time_skipped_count":0}', '2026-10-03 19:24:35'),
  ('reminder_cutoff', '2026-10-03 13:51:10', '2026-10-03 13:51:10');
/*!40000 ALTER TABLE `system_state` ENABLE KEYS */;
UNLOCK TABLES;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
