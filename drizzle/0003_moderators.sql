CREATE TABLE `moderators` (
	`email` text PRIMARY KEY NOT NULL,
	`granted_at` text NOT NULL,
	`granted_by` text,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
