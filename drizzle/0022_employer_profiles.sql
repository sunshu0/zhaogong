CREATE TABLE `employer_profiles` (
	`employer_id` text PRIMARY KEY NOT NULL,
	`page` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_email` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
