CREATE TABLE `declared_return_baselines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`effective_date` varchar(10) NOT NULL,
	`return_value` decimal(18,2) NOT NULL,
	`notes` text,
	`declared_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `declared_return_baselines_id` PRIMARY KEY(`id`),
	CONSTRAINT `declared_return_baseline_user_date_unique` UNIQUE(`user_id`,`effective_date`)
);
