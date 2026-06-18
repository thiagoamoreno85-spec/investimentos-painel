CREATE TABLE `cash_balance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` decimal(14,2) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cash_balance_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_balance_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('entrada','saida') NOT NULL,
	`category` enum('dividendo_recebido','vencimento_rf','aporte_externo','compra_ativo','resgate','taxa','outro') NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`description` text,
	`date` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_movements_id` PRIMARY KEY(`id`)
);
