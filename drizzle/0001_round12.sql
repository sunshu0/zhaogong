CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`seeker_email` text NOT NULL,
	`employer_id` text NOT NULL,
	`job_id` text,
	`started_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`seeker_email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exchanges` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`kind` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text NOT NULL,
	`offered` text NOT NULL,
	`response` text,
	`created_at` text NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`from_role` text NOT NULL,
	`text` text NOT NULL,
	`sent_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `last_role` text DEFAULT 'seeker' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `contact_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Jobs written before Round 10 kept one employment type as plain text; every job now has a JSON list (B20).
UPDATE `jobs` SET `employment_type` = json_array(`employment_type`) WHERE json_valid(`employment_type`) = 0;
