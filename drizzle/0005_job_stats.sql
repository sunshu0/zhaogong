CREATE TABLE `job_chat_starts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`seeker_email` text NOT NULL,
	`started_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `job_chat_starts_job_idx` ON `job_chat_starts` (`job_id`);--> statement-breakpoint
CREATE TABLE `job_views` (
	`job_id` text NOT NULL,
	`day` text NOT NULL,
	`visitor` text NOT NULL,
	PRIMARY KEY(`job_id`, `day`, `visitor`),
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
