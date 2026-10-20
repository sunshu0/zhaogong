-- ADR 0030: a job's candidates are who applied (source 'apply') or who chatted about it (source 'chat'). A chat row
-- has no note and no page, so both columns may be null; SQLite changes that by making the table again.
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_job_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`seeker_email` text NOT NULL,
	`job_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`source` text DEFAULT 'apply' NOT NULL,
	`note` text,
	`profile` text,
	`applied_at` text NOT NULL,
	`seen_at` text,
	`decision` text,
	`decided_at` text,
	FOREIGN KEY (`seeker_email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_job_applications`(`id`, `seeker_email`, `job_id`, `employer_id`, `source`, `note`, `profile`, `applied_at`, `seen_at`, `decision`, `decided_at`) SELECT `id`, `seeker_email`, `job_id`, `employer_id`, 'apply', `note`, `profile`, `applied_at`, `seen_at`, `decision`, `decided_at` FROM `job_applications`;--> statement-breakpoint
DROP TABLE `job_applications`;--> statement-breakpoint
ALTER TABLE `__new_job_applications` RENAME TO `job_applications`;--> statement-breakpoint
CREATE UNIQUE INDEX `job_applications_seeker_job_idx` ON `job_applications` (`seeker_email`,`job_id`);--> statement-breakpoint
CREATE INDEX `job_applications_job_idx` ON `job_applications` (`job_id`);--> statement-breakpoint
CREATE INDEX `job_applications_employer_idx` ON `job_applications` (`employer_id`);--> statement-breakpoint
-- Everyone who already has a message in a conversation about a job they did not apply for: a chat row from the
-- first message, seen then (the business saw the conversation).
INSERT INTO `job_applications`(`id`, `seeker_email`, `job_id`, `employer_id`, `source`, `applied_at`, `seen_at`)
SELECT lower(hex(randomblob(9))), c.`seeker_email`, c.`job_id`, c.`employer_id`, 'chat', m.`first_at`, m.`first_at`
FROM `conversations` c
JOIN (SELECT `conversation_id`, min(`sent_at`) AS `first_at` FROM `messages` GROUP BY `conversation_id`) m
  ON m.`conversation_id` = c.`id`
WHERE c.`job_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `job_applications` a WHERE a.`seeker_email` = c.`seeker_email` AND a.`job_id` = c.`job_id`);
