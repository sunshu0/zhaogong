CREATE TABLE `moderator_chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employer_id` text NOT NULL,
	`from_side` text NOT NULL,
	`sender_email` text NOT NULL,
	`by_name` text,
	`text` text NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moderator_chat_messages_employer_idx` ON `moderator_chat_messages` (`employer_id`,`id`);--> statement-breakpoint
CREATE TABLE `moderator_chats` (
	`employer_id` text PRIMARY KEY NOT NULL,
	`opened_by_email` text NOT NULL,
	`opened_from` text NOT NULL,
	`opened_at` text NOT NULL,
	`employer_read_at` text,
	`moderators_read_at` text,
	`updated_at` text NOT NULL
);
