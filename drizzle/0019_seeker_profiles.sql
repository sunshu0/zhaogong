CREATE TABLE `seeker_profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`profile` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
