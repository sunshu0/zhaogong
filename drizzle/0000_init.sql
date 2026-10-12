CREATE TABLE `accounts` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`employer_id` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_employer_id_unique` ON `accounts` (`employer_id`);--> statement-breakpoint
CREATE TABLE `contact_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`viewer_email` text NOT NULL,
	`viewed_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`business_number` text,
	`verification` text NOT NULL,
	`region_id` text NOT NULL,
	`created_at` text NOT NULL,
	`banned_at` text
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`country` text NOT NULL,
	`employer_id` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`industry` text NOT NULL,
	`employment_type` text NOT NULL,
	`region_id` text NOT NULL,
	`address` text,
	`pay_min_cents` integer NOT NULL,
	`pay_max_cents` integer,
	`hours_min` integer,
	`hours_max` integer,
	`shifts_zh` text,
	`meals_included` integer NOT NULL,
	`accommodation_included` integer NOT NULL,
	`visa_accepted` text NOT NULL,
	`languages` text NOT NULL,
	`description_zh` text NOT NULL,
	`description_en` text NOT NULL,
	`contact` text NOT NULL,
	`status` text NOT NULL,
	`posted_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`urgent` integer NOT NULL,
	`hires_confirmed` integer,
	`hires_confirmed_at` text,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`action` text NOT NULL,
	`job_id` text,
	`job_title` text,
	`employer_id` text,
	`employer_name` text,
	`reasons` text,
	`rules` text,
	`taken_down` integer
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`active_role` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sign_in_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer NOT NULL,
	`created_at` text NOT NULL
);
