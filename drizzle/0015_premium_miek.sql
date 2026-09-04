ALTER TABLE `assets` ADD `issuer` varchar(128);--> statement-breakpoint
ALTER TABLE `assets` ADD `maturityDate` date;--> statement-breakpoint
ALTER TABLE `assets` ADD `priceReferenceDate` timestamp;