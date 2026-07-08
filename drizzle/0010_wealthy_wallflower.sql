CREATE TABLE `patrimonial_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`asset_type` varchar(50) NOT NULL,
	`description` text,
	`current_value` decimal(15,2) NOT NULL,
	`acquisition_value` decimal(15,2),
	`acquisition_date` timestamp,
	`debtor_name` varchar(255),
	`due_date` timestamp,
	`interest_rate` decimal(5,2),
	`notes` text,
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patrimonial_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patrimonial_liabilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`asset_id` int,
	`name` varchar(255) NOT NULL,
	`creditor` varchar(255),
	`original_amount` decimal(15,2) NOT NULL,
	`remaining_balance` decimal(15,2) NOT NULL,
	`installment_value` decimal(15,2),
	`total_installments` int,
	`paid_installments` int NOT NULL DEFAULT 0,
	`interest_rate` decimal(5,2),
	`start_date` timestamp NOT NULL,
	`end_date` timestamp,
	`notes` text,
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patrimonial_liabilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patrimonial_liability_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`liability_id` int NOT NULL,
	`payment_date` timestamp NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`installment_number` int,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patrimonial_liability_payments_id` PRIMARY KEY(`id`)
);
