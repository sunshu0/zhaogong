CREATE TABLE `external_company_blocks` (
	`company_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`requester` text,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
