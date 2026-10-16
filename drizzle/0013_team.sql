CREATE TABLE `team_chats` (
	`employer_id` text PRIMARY KEY NOT NULL,
	`record` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`invited_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`answered_at` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_invites_email_idx` ON `team_invites` (`email`);--> statement-breakpoint
CREATE INDEX `team_invites_employer_idx` ON `team_invites` (`employer_id`);--> statement-breakpoint
DROP INDEX `accounts_employer_id_unique`;--> statement-breakpoint
ALTER TABLE `accounts` ADD `team_role` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `team_name` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `team_joined_at` text;--> statement-breakpoint
CREATE INDEX `accounts_employer_idx` ON `accounts` (`employer_id`);--> statement-breakpoint
UPDATE `accounts` SET `team_role` = 'admin', `team_joined_at` = `created_at` WHERE `employer_id` IS NOT NULL;