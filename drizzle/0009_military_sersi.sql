CREATE TABLE `portfolio_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`totalValue` decimal(18,2) NOT NULL,
	`totalCost` decimal(18,2) NOT NULL,
	`cashBalance` decimal(14,2) NOT NULL DEFAULT '0',
	`usdBrl` decimal(10,4) NOT NULL,
	`classBreakdown` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_snapshots_id` PRIMARY KEY(`id`)
);
