ALTER TABLE `conversations` ADD `seeker_name` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `seeker_read_at` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `employer_read_at` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `updated_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_seeker_employer_job_idx` ON `conversations` (`seeker_email`,`employer_id`,`job_id`);--> statement-breakpoint
ALTER TABLE `messages` ADD `by_name` text;