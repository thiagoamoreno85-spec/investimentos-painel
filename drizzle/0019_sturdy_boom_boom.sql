CREATE TABLE `market_flow_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`b3_reported_through` varchar(10) NOT NULL,
	`b3_sessions` int NOT NULL,
	`b3_foreign_flow_brl` decimal(18,2) NOT NULL,
	`b3_domestic_flow_brl` decimal(18,2) NOT NULL,
	`ewz_shares_outstanding` decimal(20,2),
	`ewz_net_assets_usd` decimal(20,2),
	`ewz_nav_usd` decimal(12,4),
	`ewz_shares_change` decimal(20,2),
	`ewz_flow_proxy_usd` decimal(20,2),
	`source_b3` text NOT NULL,
	`source_ewz` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_flow_snapshots_id` PRIMARY KEY(`id`)
);
