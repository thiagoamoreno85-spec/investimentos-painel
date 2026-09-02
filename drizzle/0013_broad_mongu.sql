CREATE TABLE `daily_performance_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`startValue` decimal(18,2) NOT NULL,
	`endValue` decimal(18,2) NOT NULL,
	`marketPnl` decimal(18,2) NOT NULL,
	`incomePnl` decimal(18,2) NOT NULL,
	`returnValue` decimal(18,2) NOT NULL,
	`returnPct` decimal(18,8) NOT NULL,
	`classBreakdown` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_performance_snapshots_id` PRIMARY KEY(`id`)
);
