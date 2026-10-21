ALTER TABLE `assets` ADD `normalizedTicker` varchar(32) NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `assets` SET `normalizedTicker` = UPPER(TRIM(`ticker`));--> statement-breakpoint
ALTER TABLE `assets` ALTER COLUMN `normalizedTicker` DROP DEFAULT;--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_user_normalized_ticker_unique` UNIQUE(`userId`,`normalizedTicker`);
