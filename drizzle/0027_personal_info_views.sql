CREATE TABLE `personal_info_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`day` text NOT NULL,
	`moderator_email` text NOT NULL,
	`kind` text NOT NULL,
	`subject_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `personal_info_views_day_idx` ON `personal_info_views` (`day`);--> statement-breakpoint
CREATE INDEX `personal_info_views_moderator_day_idx` ON `personal_info_views` (`moderator_email`,`day`);