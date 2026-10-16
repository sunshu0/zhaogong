CREATE TABLE `job_renewals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`renewed_at` text NOT NULL,
	`days` integer NOT NULL,
	`expires_before` text NOT NULL,
	`expires_after` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `job_renewals_job_idx` ON `job_renewals` (`job_id`);