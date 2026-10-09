ALTER TABLE `assets` ADD `positionTrackingMode` enum('ledger','reconciled') DEFAULT 'ledger' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `reconciliationBaseQuantity` decimal(18,8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `reconciliationBaseCost` decimal(18,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `ledgerStartTransactionId` int;