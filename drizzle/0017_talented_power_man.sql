CREATE TABLE `valuation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`usd_brl_reference` decimal(10,4),
	`reference_date` timestamp,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `valuation_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `valuation_settings_userId_unique` UNIQUE(`userId`)
);
