CREATE TABLE `employer_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`type` text NOT NULL,
	`bytes` integer NOT NULL,
	`status` text NOT NULL,
	`reject_reason` text,
	`stored` integer DEFAULT 1 NOT NULL,
	`uploaded_by_email` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`reviewed_by_email` text,
	`reviewed_at` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employer_photos_employer_idx` ON `employer_photos` (`employer_id`,`status`);--> statement-breakpoint
CREATE INDEX `employer_photos_status_idx` ON `employer_photos` (`status`,`uploaded_at`);--> statement-breakpoint
ALTER TABLE `employer_profiles` ADD `benefits` text;