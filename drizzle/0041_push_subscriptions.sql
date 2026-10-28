CREATE TABLE `push_subscriptions` (
  `endpoint` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  `email` text NOT NULL REFERENCES `accounts`(`email`),
  `role` text NOT NULL,
  `p256dh` text NOT NULL,
  `auth` text NOT NULL,
  `lang` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_session_idx` ON `push_subscriptions` (`session_id`);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_email_idx` ON `push_subscriptions` (`email`);
--> statement-breakpoint
CREATE TABLE `push_setups` (
  `session_id` text PRIMARY KEY NOT NULL REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  `attempted_at` text NOT NULL
);
