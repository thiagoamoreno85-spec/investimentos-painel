ALTER TABLE `assets` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `transactions` ADD `importFingerprint` varchar(64);--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_user_ticker_unique` UNIQUE(`userId`,`ticker`);--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_import_fingerprint_unique` UNIQUE(`userId`,`importFingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_asset_date_id_idx` ON `transactions` (`assetId`,`transactionDate`,`id`);