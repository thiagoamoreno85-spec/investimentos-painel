ALTER TABLE `daily_performance_snapshots` ADD `capturedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_performance_snapshots` ADD `valuationAsOf` timestamp;--> statement-breakpoint
ALTER TABLE `daily_performance_snapshots` ADD `status` enum('final') DEFAULT 'final' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_performance_snapshots` ADD `fxRate` decimal(10,4);--> statement-breakpoint
ALTER TABLE `daily_performance_snapshots` ADD `fxSource` enum('conciliacao','mercado');--> statement-breakpoint
ALTER TABLE `portfolio_snapshots` ADD `capturedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_snapshots` ADD `valuationAsOf` timestamp;--> statement-breakpoint
ALTER TABLE `portfolio_snapshots` ADD `valuationQuality` enum('complete','partial') DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_performance_snapshots` ADD CONSTRAINT `daily_performance_user_date_unique` UNIQUE(`userId`,`snapshotDate`);--> statement-breakpoint
ALTER TABLE `portfolio_snapshots` ADD CONSTRAINT `portfolio_snapshot_user_date_unique` UNIQUE(`userId`,`snapshotDate`);