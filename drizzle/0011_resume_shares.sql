CREATE TABLE `resume_shares` (
	`email` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`resume` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resume_shares_id_unique` ON `resume_shares` (`id`);