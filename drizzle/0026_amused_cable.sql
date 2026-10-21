ALTER TABLE `dividends` MODIFY COLUMN `exDate` timestamp;--> statement-breakpoint
ALTER TABLE `analysisHistory` ADD `cacheKey` varchar(64);--> statement-breakpoint
ALTER TABLE `analysisHistory` ADD `dataVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `assets` ADD `priceSource` varchar(64);--> statement-breakpoint
ALTER TABLE `assets` ADD `priceState` varchar(32);--> statement-breakpoint
ALTER TABLE `assets` ADD `priceAsOf` timestamp;--> statement-breakpoint
CREATE INDEX `analysis_history_user_cache_created_idx` ON `analysisHistory` (`userId`,`cacheKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `dividends_user_currency_payment_idx` ON `dividends` (`userId`,`currency`,`paymentDate`);