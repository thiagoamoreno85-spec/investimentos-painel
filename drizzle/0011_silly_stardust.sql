CREATE TABLE `cash_reconciliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`statementId` int NOT NULL,
	`platformBalance` decimal(18,2) NOT NULL,
	`statementBalance` decimal(18,2) NOT NULL,
	`discrepancy` decimal(18,2) NOT NULL,
	`status` enum('pending','reconciled','discrepancy_found') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cash_reconciliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_statements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`uploadDate` timestamp NOT NULL DEFAULT (now()),
	`statementMonth` varchar(7) NOT NULL,
	`startBalance` decimal(18,2) NOT NULL,
	`endBalance` decimal(18,2) NOT NULL,
	`status` enum('pending','processed','reconciled','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cash_statements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `received_incomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`statementId` int NOT NULL,
	`type` enum('dividendo','jcp','aluguel','rendimento','outro') NOT NULL,
	`description` varchar(256) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`incomeDate` timestamp NOT NULL,
	`category` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `received_incomes_id` PRIMARY KEY(`id`)
);
