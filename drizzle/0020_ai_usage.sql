CREATE TABLE `ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`at` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cache_read_tokens` integer NOT NULL,
	`cache_write_tokens` integer NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_email_at_idx` ON `ai_usage` (`email`,`at`);--> statement-breakpoint
CREATE INDEX `ai_usage_at_idx` ON `ai_usage` (`at`);