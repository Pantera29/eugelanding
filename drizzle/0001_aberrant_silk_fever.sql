CREATE TABLE `therapy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`mode` text NOT NULL,
	`availability` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` text NOT NULL,
	`privacy_version` text NOT NULL,
	`privacy_read_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `requests_session` ON `therapy_requests` (`session`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `duration` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `privacy_version` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `privacy_read_at` text;