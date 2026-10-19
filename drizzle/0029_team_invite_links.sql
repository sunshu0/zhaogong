CREATE TABLE `team_invite_links` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`used_by_email` text,
	`used_at` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invite_links_token_hash_unique` ON `team_invite_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `team_invite_links_employer_idx` ON `team_invite_links` (`employer_id`);