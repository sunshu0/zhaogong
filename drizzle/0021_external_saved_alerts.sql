CREATE TABLE `external_job_alert_hits` (
	`email` text NOT NULL,
	`external_job_id` text NOT NULL,
	`alert_name` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`email`, `external_job_id`),
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`external_job_id`) REFERENCES `external_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `saved_external_jobs` (
	`email` text NOT NULL,
	`external_job_id` text NOT NULL,
	`saved_at` text NOT NULL,
	`stage` text,
	`stage_set_at` text,
	PRIMARY KEY(`email`, `external_job_id`),
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`external_job_id`) REFERENCES `external_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `job_alerts` ADD `section` text;