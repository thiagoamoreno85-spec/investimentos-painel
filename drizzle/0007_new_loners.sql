CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` int NOT NULL,
	`ticker` varchar(32) NOT NULL,
	`eventType` enum('earnings','dividendo','split','ipo','desdobramento','agrupamento','evento_corporativo','outro') NOT NULL,
	`description` text,
	`eventDate` timestamp NOT NULL,
	`exDate` timestamp,
	`expectedValue` decimal(18,8),
	`valueUnit` varchar(10) DEFAULT 'BRL',
	`status` enum('agendado','realizado','cancelado') DEFAULT 'agendado',
	`actualResult` text,
	`notificationSent` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
