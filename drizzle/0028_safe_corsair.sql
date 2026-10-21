ALTER TABLE `alerts` ADD `sourceNewsId` int;--> statement-breakpoint
ALTER TABLE `newsItems` ADD `contentFingerprint` varchar(64);--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_user_news_asset_type_unique` UNIQUE(`userId`,`sourceNewsId`,`assetId`,`type`);--> statement-breakpoint
ALTER TABLE `newsItems` ADD CONSTRAINT `news_items_user_fingerprint_unique` UNIQUE(`userId`,`contentFingerprint`);--> statement-breakpoint
CREATE INDEX `news_items_user_published_idx` ON `newsItems` (`userId`,`publishedAt`);