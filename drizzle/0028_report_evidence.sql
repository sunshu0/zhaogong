CREATE TABLE `report_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` text NOT NULL,
	`reporter_email` text NOT NULL,
	`kind` text NOT NULL,
	`message_id` integer,
	`message_from` text,
	`message_by_name` text,
	`message_text` text,
	`message_sent_at` text,
	`image_key` text,
	`image_type` text,
	`image_bytes` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `report_evidence_report_idx` ON `report_evidence` (`report_id`);--> statement-breakpoint
CREATE INDEX `report_evidence_reporter_idx` ON `report_evidence` (`reporter_email`);