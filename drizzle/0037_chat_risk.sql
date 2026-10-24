CREATE TABLE `chat_risk_flags` (
	`employer_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`since` text,
	`opened_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE TABLE `chat_risk_hits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employer_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` integer NOT NULL,
	`rules` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_risk_hits_employer_at_idx` ON `chat_risk_hits` (`employer_id`,`at`);--> statement-breakpoint
CREATE INDEX `chat_risk_hits_conversation_idx` ON `chat_risk_hits` (`conversation_id`);