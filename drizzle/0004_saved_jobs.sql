CREATE TABLE `saved_jobs` (
	`email` text NOT NULL,
	`job_id` text NOT NULL,
	`saved_at` text NOT NULL,
	`stage` text,
	`stage_set_at` text,
	PRIMARY KEY(`email`, `job_id`),
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
