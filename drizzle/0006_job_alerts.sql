CREATE TABLE `job_alert_hits` (
	`email` text NOT NULL,
	`job_id` text NOT NULL,
	`alert_name` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`email`, `job_id`),
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`query` text NOT NULL,
	`paused` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `job_alerts_email_idx` ON `job_alerts` (`email`);