CREATE TABLE `analysisHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`availableAmount` decimal(18,2) NOT NULL,
	`focus` enum('brasil','eua','todos') NOT NULL,
	`userContext` text,
	`analysisText` text NOT NULL,
	`recommendedTicker` varchar(32),
	`quotesSnapshot` text,
	`usdBrl` decimal(10,4),
	`assetsAnalyzed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysisHistory_id` PRIMARY KEY(`id`)
);
