CREATE TABLE `chat_records` (
	`scope` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`record` text,
	`notification_reads` text,
	`applied_changes` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_records_email_idx` ON `chat_records` (`email`);