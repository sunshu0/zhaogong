CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`status` text NOT NULL,
	`slots` text NOT NULL,
	`call_first` integer NOT NULL,
	`mode` text,
	`place` text NOT NULL,
	`note` text NOT NULL,
	`chosen_slot` text,
	`reply` text NOT NULL,
	`invited_at` text NOT NULL,
	`responded_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `job_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interviews_application_id_unique` ON `interviews` (`application_id`);