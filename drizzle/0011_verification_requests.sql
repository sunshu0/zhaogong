CREATE TABLE `verification_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`kind` text NOT NULL,
	`nzbn` text NOT NULL,
	`legal_name` text NOT NULL,
	`trading_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_role` text NOT NULL,
	`company_phone` text NOT NULL,
	`website` text,
	`submitted_by_email` text NOT NULL,
	`submitted_at` text NOT NULL,
	`status` text NOT NULL,
	`decided_at` text,
	`decided_by_email` text,
	`checklist` text,
	`reject_reason` text,
	`reject_note` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `verification_requests_employer_idx` ON `verification_requests` (`employer_id`);--> statement-breakpoint
CREATE INDEX `verification_requests_status_idx` ON `verification_requests` (`status`);--> statement-breakpoint
ALTER TABLE `moderation_log` ADD `note` text;