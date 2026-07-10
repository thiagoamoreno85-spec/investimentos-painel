CREATE TABLE `cash_deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`statementId` int NOT NULL,
	`description` varchar(256) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`depositDate` timestamp NOT NULL,
	`category` varchar(128) NOT NULL DEFAULT 'aporte',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_deposits_id` PRIMARY KEY(`id`)
);
