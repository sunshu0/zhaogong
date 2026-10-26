ALTER TABLE `employers` ADD `banned_until` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `moderation_log` ADD `ban_days` integer;