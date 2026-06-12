CREATE TABLE `newsItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`impactAnalysis` text,
	`source` varchar(100),
	`sourceUrl` text,
	`category` enum('brasil','global','cripto','tech','politica','macro') DEFAULT 'global',
	`impactLevel` enum('alto','medio','baixo') DEFAULT 'baixo',
	`sentiment` enum('positivo','negativo','neutro') DEFAULT 'neutro',
	`affectedTickers` text,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`isRead` int NOT NULL DEFAULT 0,
	CONSTRAINT `newsItems_id` PRIMARY KEY(`id`)
);
