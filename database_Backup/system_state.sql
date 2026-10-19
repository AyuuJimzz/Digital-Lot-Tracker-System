-- Golden Dragon Corp Database Backup
-- Table: system_state
-- Generated on: 2026-10-19T13:44:53.436Z

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;
DROP TABLE IF EXISTS `system_state`;
CREATE TABLE `system_state` (
  `state_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `state_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES `system_state` WRITE;
/*!40000 ALTER TABLE `system_state` DISABLE KEYS */;
INSERT INTO `system_state` (`state_key`, `state_value`, `updated_at`) VALUES
  ('authRevocationTimestamp', '"2026-09-23T00:00:00.000Z"', '2026-09-23 21:51:52'),
  ('developerPin', '"5551"', '2026-09-23 21:51:52'),
  ('maintenanceMode', 'false', '2026-10-13 10:24:17'),
  ('non_saleable_manual_exclusions', '[]', '2026-09-26 17:42:30'),
  ('non_saleable_migration_meta', '{"executed_at":"2026-10-19T03:28:00.366Z","completed_without_conflicts":true,"total_parcels":596,"candidate_count":22,"flagged_count":22,"skipped_exclusions":[],"preflight_conflicts_count":0,"write_time_skipped_count":0}', '2026-10-19 03:28:00'),
  ('reminder_cutoff', '2026-10-01 16:50:05', '2026-10-01 16:50:05');
/*!40000 ALTER TABLE `system_state` ENABLE KEYS */;
UNLOCK TABLES;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
