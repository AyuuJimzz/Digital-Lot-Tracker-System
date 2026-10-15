-- Golden Dragon Corp Database Backup
-- Table: account_login_history
-- Generated on: 2026-10-15T04:23:42.615Z

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;
DROP TABLE IF EXISTS `account_login_history`;
CREATE TABLE `account_login_history` (
  `login_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `account_role` varchar(16) NOT NULL,
  `account_id` int(11) NOT NULL,
  `session_hash` char(64) NOT NULL,
  `device` varchar(100) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `signed_in_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`login_id`),
  UNIQUE KEY `uq_login_session` (`session_hash`),
  KEY `idx_login_account` (`account_role`,`account_id`,`signed_in_at`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

LOCK TABLES `account_login_history` WRITE;
/*!40000 ALTER TABLE `account_login_history` DISABLE KEYS */;
INSERT INTO `account_login_history` (`login_id`, `account_role`, `account_id`, `session_hash`, `device`, `ip_address`, `signed_in_at`) VALUES
  (1, 'employee', 19, 'f2b2146f00726544acfb283be3065383ca02d34a9de13155aea548e30067ea00', 'Windows PC · Chrome', '::1', '2026-09-27 01:21:50'),
  (2, 'employee', 13, 'f056560e028377173e70540e5c80c584c50238a8898633b4295d883fdeeeb488', 'Windows PC · Edge', '::1', '2026-09-27 01:22:28'),
  (3, 'employee', 13, '5414e9526efd6f96b71b207771d1708d006389cbc3bbff50e15007779359d8b5', 'Windows PC · Chrome', '::1', '2026-09-27 01:22:35'),
  (4, 'employee', 13, '19dac83e68ec56ab363f3d0be3b2d6162070947207285a8764341ab3efe0b0d5', 'Windows PC · Chrome', '::1', '2026-09-27 01:23:00'),
  (5, 'employee', 13, '024c5d3a3fc79fa55ede2ac717b5fe07c5da205fe7f897a986a5192b82d7f81d', 'Windows PC · Chrome', '::1', '2026-09-27 01:23:03'),
  (6, 'employee', 13, '182dec099dc63f9b5cde233399f5d194fe45505ea7be8a2abb258426232e9f1f', 'Windows PC · Chrome', '::1', '2026-09-27 01:23:07'),
  (7, 'employee', 13, '4fde2ce4c6da8b92342eb88bb80cfe827c0c01c1bc1ba657a5e1c6c245c19c77', 'Windows PC · Chrome', '::1', '2026-09-27 01:23:15'),
  (8, 'admin', 2, 'e1f647b804321b46f9388c268d05c3e5566ec035876ea82ceeb955271738020b', 'Windows PC · Chrome', '::1', '2026-09-27 01:27:53'),
  (9, 'admin', 2, '156b7ee242f387fe09cb735b1a8376d68f1f82e6c28c0d6c193337d2058fcad5', 'Windows PC · Chrome', '::1', '2026-09-27 10:57:28'),
  (10, 'admin', 2, '0f2e63e4aecaffe8c574ed146cf3d760875c2216f361d675dde579950de85aca', 'Windows PC · Chrome', '::1', '2026-09-27 11:00:43'),
  (11, 'admin', 2, '15110f7fd59e3627cd900a5719b55b8ffaa674afa18dcb7d3fd2a482e9504aec', 'Windows PC · Chrome', '::1', '2026-09-28 10:50:43'),
  (12, 'employee', 13, 'cc8f642f643b0c97d5416d26da5c7439ace5a36875499aec3b35e98e72a4ae88', 'Windows PC · Chrome', '::1', '2026-09-28 10:53:42'),
  (13, 'employee', 19, '4661b612b92e556bc1104102f0f1764e3d59729679494fe8ef4bbc8b2d566716', 'Windows PC · Chrome', '::1', '2026-09-28 11:00:24'),
  (14, 'admin', 2, 'dde8b308ab807cdc181d229f423218cf37ae244b23db5f3937086a2777e316ba', 'Windows PC · Chrome', '::1', '2026-09-28 11:01:22'),
  (15, 'employee', 13, '90a53c25872f82de16fa29864efa3109b79e4e22cc89c4e09e441154147a62dc', 'Windows PC · Chrome', '::1', '2026-09-28 11:51:58'),
  (16, 'admin', 2, '698342b110f4423aba887739e89b302cbbd865da50e642276471fc0a3042309a', 'Windows PC · Chrome', '::1', '2026-09-28 11:52:09'),
  (17, 'admin', 2, '1dabce2c8b150f2ac01afa534bf73abed9fb1d6de4adc0510224210419bad950', 'Windows PC · Chrome', '::1', '2026-09-28 12:15:51'),
  (18, 'employee', 13, '24e25d4fb42cc866bdbef0507d6b71eb59732ebdcc3b287cd09d764aa13dcc30', 'Windows PC · Chrome', '::1', '2026-09-28 12:21:10'),
  (19, 'admin', 2, 'd4c3f0d5efbeec8df6712df1f763dd5911b4ad23957ed7e98fd502946f738fb0', 'Windows PC · Chrome', '::1', '2026-09-28 16:33:35'),
  (20, 'employee', 13, 'f656ebbd20f57b7009fc93f447f78a507e5175a4f69aaeca3dae301b3de7c004', 'Windows PC · Chrome', '::1', '2026-09-28 18:17:31'),
  (21, 'admin', 2, 'fabccacb36b3800a66c13546f9b0931faf8a69c4a23684a85b0c4497688a8dd9', 'Windows PC · Chrome', '::1', '2026-09-28 18:18:13'),
  (22, 'employee', 13, '13974a09705bc9bb4d1e408ff7fe6d16451a65f543892ea615a26a2d99870973', 'Windows PC · Chrome', '::1', '2026-09-28 18:18:28'),
  (23, 'admin', 2, 'f123b56d7e907a7fda99227693ce908811df18760f4ab2e7bfedc812c893735a', 'Windows PC · Chrome', '::1', '2026-09-28 18:29:44'),
  (24, 'employee', 13, 'a903b037e4a2f5f535fbb44fd0d6a2bd2a6f0322ed501957d4795e51383556e6', 'Windows PC · Chrome', '::1', '2026-09-28 19:01:41'),
  (25, 'admin', 2, 'ad96670875fbb33e08387fc5a114851d93fdbf55f63419b629e51c723386a2a4', 'Windows PC · Chrome', '::1', '2026-09-28 19:03:52'),
  (26, 'employee', 13, '755d4f7be42ca9856cc2a1c162c0bd6ac9eb4556e3ce440b4f9628d1919e3e21', 'Windows PC · Chrome', '::1', '2026-09-28 22:06:13'),
  (27, 'admin', 2, '2f9ad291db721b85eb67e31c41405c32bddc5bda4b140cc1952f56f1e035a6ea', 'Windows PC · Chrome', '::1', '2026-09-28 22:10:17'),
  (28, 'admin', 2, '18a5a5a2d4f5ae285aa5aaf2573ab52772ca95cc10ea4180128ead9d2ac6d0b0', 'Android Device · Chrome', '::1', '2026-09-29 00:18:39'),
  (29, 'admin', 2, '8ac9f2c5e463c31e5ca0329aa80570d83bb80f24bd138f56c097a30faf56ebd9', 'Windows PC · Chrome', '::1', '2026-09-29 00:27:34'),
  (30, 'admin', 2, '51ed8338986f1ad83c40e6efbe378c83868035893ce3f1e1c4bbe390226aa9e7', 'Windows PC · Chrome', '::1', '2026-09-29 11:10:02'),
  (31, 'admin', 2, '1a6165d7e7e30d123d4686097d86c2aaadf31bdc17b672636f4f36ef65835ba3', 'Windows PC · Chrome', '::1', '2026-10-03 13:52:31'),
  (32, 'employee', 13, 'bb4a2a7ec7cd117a7c397e1e3fcf424f3993813720e1e803535d0b2ecb284375', 'Windows PC · Chrome', '::1', '2026-10-03 13:52:44'),
  (33, 'admin', 2, '373534848eef1ffab2f727e0acfecf3f7a284083684a8fc134f01fdd0f9d81f2', 'Windows PC · Chrome', '::1', '2026-10-03 13:53:19'),
  (34, 'employee', 19, '048a2fc180967f64811c76544d8af42104ed556f35f2081a04a6c0a1e1536f70', 'Windows PC · Chrome', '::1', '2026-10-03 15:19:14'),
  (35, 'admin', 2, '9a748b7673719aca0f76878717409b7dff5235d05bdab7f9a2b6f0e856b734da', 'Windows PC · Chrome', '::1', '2026-10-03 15:19:36'),
  (36, 'employee', 19, '61f0cd8778dbb4d755c77ad62e23de1e39d3a76689d49449e6b60c117510d131', 'Windows PC · Chrome', '::1', '2026-10-03 16:34:37'),
  (37, 'admin', 2, '60dc6b7ba2e286a79d7ccd9b96a453129399465606378855570914956e4a8d5e', 'Windows PC · Chrome', '::1', '2026-10-03 16:35:39'),
  (38, 'employee', 19, 'b5479eac5f53d57fd6c09e0480fb661155d20fe6d4bbcbcd1de19197bc57bd90', 'Windows PC · Chrome', '::1', '2026-10-03 16:36:01'),
  (39, 'admin', 2, '043a510105db1cd4c575c2af5a7382af5de3f98c46e64fd6b83c415143b6dd8a', 'Windows PC · Chrome', '::1', '2026-10-03 16:50:11'),
  (40, 'admin', 2, 'ff87f821b32c7969b6dc5151c237f1ff9d336832528923babe928aa0d72ca532', 'Windows PC · Chrome', '::1', '2026-10-03 16:52:37'),
  (41, 'employee', 19, '0ba45a2387b0e839ea01e75f3f24ab50509d5899a6a3846b11b1bed28e78e72a', 'Windows PC · Chrome', '127.0.0.1', '2026-10-03 16:57:17'),
  (42, 'admin', 2, '67780ab0b3ea62222a53e5a5ae891703d192bc97c86631fa100ca06ed1721949', 'Windows PC · Chrome', '::1', '2026-10-03 16:59:39'),
  (43, 'employee', 19, '8447cc8196c081901db02d30a53096afda2e5b968b45bad98cfd1194ed095628', 'Windows PC · Chrome', '::1', '2026-10-03 17:25:56'),
  (44, 'employee', 13, '38dc1f9b8f1a051b1fc7c4f75b3a26e8d48aa1988391b5294d69ecabb7a35585', 'Windows PC · Chrome', '::1', '2026-10-03 17:27:49'),
  (45, 'admin', 2, '7aa25f61e7f2f8f421c66ee36ca1952df32d9a81e10d3127d4d7ddec4672ae06', 'Windows PC · Chrome', '::1', '2026-10-03 17:28:04'),
  (46, 'employee', 19, 'e3e1fdbb48bba277c97dc73f8a9cbadff1c0fe3606e05e2d72933f5e04c9dc28', 'Windows PC · Chrome', '::1', '2026-10-03 17:28:46'),
  (47, 'employee', 13, '1d5fa9d6d096fb219dc81ccc72cfd99aa1f1740fe15450509dbff23bbfa6b188', 'Windows PC · Chrome', '::1', '2026-10-03 17:29:20'),
  (48, 'admin', 2, '531432301168b7a1fb50b96a1c85ec8cf85c575c4de602fadfb2c0bc0e45a28c', 'Windows PC · Chrome', '::1', '2026-10-03 17:32:31'),
  (49, 'employee', 19, '4130fafab7057a2bf7df83a2920ec9d8ff8b5e11f23efc4bb97de5217a62c183', 'Windows PC · Chrome', '::1', '2026-10-03 17:32:47'),
  (50, 'employee', 13, '006d7c18fd6b86ac50329eecf6492be6541e790d4f524d0f591d1b558ad98777', 'Windows PC · Chrome', '::1', '2026-10-03 17:32:59'),
  (51, 'admin', 2, '14c7a0c191c5669afef22ffc03ac239920e8ac5534cbbea957b10fd950517bcc', 'Windows PC · Chrome', '::1', '2026-10-03 17:33:19'),
  (52, 'employee', 13, '84c6e1cf0c0b40f0173a8abe879c4d6f2d12a421b2db88aa43c5a7d690010f14', 'Windows PC · Chrome', '::1', '2026-10-03 17:35:51'),
  (53, 'admin', 2, '94ceb0d9b0898c76edd30699320d960f336b69f3e73098cfc6097ed991f14d99', 'Windows PC · Chrome', '::1', '2026-10-03 17:42:06'),
  (54, 'employee', 13, '2f4efdb6c3ed6ecabced2d42bd2c8fec1462ace206926be40e56be247c74784d', 'Windows PC · Chrome', '::1', '2026-10-03 17:45:59'),
  (55, 'employee', 19, 'a74632d519c433d35d67943cc087210004401220444817637f13b3f9ad781bc8', 'Windows PC · Chrome', '127.0.0.1', '2026-10-03 18:28:57'),
  (56, 'employee', 13, 'e28e43a3dc329c690d1508b93412ebf3db4a3ee240d2653869c470f47a3f9f70', 'Windows PC · Chrome', '::1', '2026-10-03 18:41:23'),
  (57, 'admin', 2, '91fce189731ef604b926839d31827576f932fe8765eb9a83151deda22943e5ce', 'Windows PC · Chrome', '127.0.0.1', '2026-10-03 21:10:36'),
  (58, 'employee', 13, 'bd07bc09c73b55bf36e491624e64f674cf33132fd545a08fb4fd5c497402e869', 'Windows PC · Chrome', '::1', '2026-10-03 21:13:36'),
  (59, 'admin', 2, '09210dcd30e63b015046a35a088f9890bc9799efbb589f78e2e34d23b90b8b82', 'Windows PC · Edge', '::1', '2026-10-15 10:26:49'),
  (60, 'employee', 13, 'f238c1a82b4ef3852ecc64b46cd685d0332cbf70dffba016c7bcc3a46b9c39a4', 'Windows PC · Edge', '::1', '2026-10-15 11:41:25'),
  (61, 'admin', 2, '452573504543ed044b93434da749ea28ed2d9f2c75cbd1da0ca40bee9f6e9838', 'Windows PC · Edge', '::1', '2026-10-15 11:43:33');
/*!40000 ALTER TABLE `account_login_history` ENABLE KEYS */;
UNLOCK TABLES;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
