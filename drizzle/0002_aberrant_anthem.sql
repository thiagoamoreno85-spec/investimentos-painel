CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` int NOT NULL,
	`type` enum('price_drop','price_rise','below_avg_cost','above_target','below_target','buy_opportunity') NOT NULL,
	`threshold` decimal(18,4) NOT NULL,
	`targetPrice` decimal(18,8),
	`status` enum('active','triggered','dismissed') NOT NULL DEFAULT 'active',
	`triggeredMessage` text,
	`triggeredAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dividends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` int NOT NULL,
	`type` enum('dividendo','jcp','rendimento','amortizacao','bonificacao','outro') NOT NULL,
	`valuePerShare` decimal(18,8) NOT NULL,
	`quantity` decimal(18,8) NOT NULL,
	`totalValue` decimal(18,2) NOT NULL,
	`currency` enum('BRL','USD') NOT NULL DEFAULT 'BRL',
	`exDate` timestamp NOT NULL,
	`paymentDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dividends_id` PRIMARY KEY(`id`)
);
