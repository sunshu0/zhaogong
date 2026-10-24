CREATE TABLE `employer_activity` (
	`employer_id` text PRIMARY KEY NOT NULL,
	`last_active_at` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
