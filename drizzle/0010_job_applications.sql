CREATE TABLE `job_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`seeker_email` text NOT NULL,
	`job_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`note` text NOT NULL,
	`profile` text NOT NULL,
	`applied_at` text NOT NULL,
	`seen_at` text,
	`decision` text,
	`decided_at` text,
	FOREIGN KEY (`seeker_email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_applications_seeker_job_idx` ON `job_applications` (`seeker_email`,`job_id`);--> statement-breakpoint
CREATE INDEX `job_applications_job_idx` ON `job_applications` (`job_id`);--> statement-breakpoint
CREATE INDEX `job_applications_employer_idx` ON `job_applications` (`employer_id`);