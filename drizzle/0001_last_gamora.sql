CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`assetClass` enum('rv_nacional','rv_eua','fundos','cripto','renda_fixa','uranio','india','caixa') NOT NULL,
	`currency` enum('BRL','USD') NOT NULL DEFAULT 'BRL',
	`totalQuantity` decimal(18,8) NOT NULL DEFAULT '0',
	`averageCost` decimal(18,8) NOT NULL DEFAULT '0',
	`totalCost` decimal(18,2) NOT NULL DEFAULT '0',
	`lastPrice` decimal(18,8) NOT NULL DEFAULT '0',
	`lastPriceUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` int NOT NULL,
	`type` enum('buy','sell') NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`unitPrice` decimal(18,8) NOT NULL,
	`totalValue` decimal(18,2) NOT NULL,
	`fees` decimal(18,2) NOT NULL DEFAULT '0',
	`transactionDate` timestamp NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
