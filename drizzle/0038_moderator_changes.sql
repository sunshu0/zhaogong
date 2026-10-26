CREATE TABLE `moderator_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`action` text NOT NULL,
	`email` text NOT NULL,
	`by` text
);
--> statement-breakpoint
CREATE INDEX `moderator_changes_at_idx` ON `moderator_changes` (`at`);