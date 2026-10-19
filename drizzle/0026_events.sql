CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`at` text NOT NULL,
	`day` text NOT NULL,
	`visitor` text NOT NULL,
	`path` text NOT NULL,
	`lang` text NOT NULL,
	`role` text NOT NULL,
	`job_id` text,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `events_day_name_idx` ON `events` (`day`,`name`);--> statement-breakpoint
CREATE INDEX `events_visitor_day_idx` ON `events` (`visitor`,`day`,`name`);