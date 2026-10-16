CREATE TABLE `external_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`company_name` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`city` text NOT NULL,
	`field` text NOT NULL,
	`kind` text,
	`closes_at` text,
	`min_years` integer,
	`degree` text,
	`degree_subjects` text NOT NULL,
	`visa` text NOT NULL,
	`pay` text,
	`url` text NOT NULL,
	`posted_at` text,
	`flags` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`removed_at` text,
	`removed_reason` text,
	`review` text NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `external_jobs_company_idx` ON `external_jobs` (`company_id`);--> statement-breakpoint
CREATE INDEX `external_jobs_review_idx` ON `external_jobs` (`review`);