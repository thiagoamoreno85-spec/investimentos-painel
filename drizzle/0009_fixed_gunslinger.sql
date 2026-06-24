CREATE TABLE `portfolio_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotDate` timestamp NOT NULL,
	`totalValueBRL` decimal(18,2) NOT NULL,
	`totalCostBRL` decimal(18,2) NOT NULL,
	`cashBRL` decimal(14,2) NOT NULL DEFAULT '0',
	`usdBrlRate` decimal(10,4) NOT NULL,
	`classValuesJSON` text NOT NULL,
	`classCostsJSON` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_snapshots_id` PRIMARY KEY(`id`)
);
