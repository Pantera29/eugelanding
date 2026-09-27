CREATE TABLE `blocked` (
	`date` text NOT NULL,
	`time` text NOT NULL,
	PRIMARY KEY(`date`, `time`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'active',
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_slot` ON `bookings` (`date`,`time`) WHERE "bookings"."status" = 'active';--> statement-breakpoint
CREATE INDEX `bookings_session` ON `bookings` (`session`);--> statement-breakpoint
CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session` text NOT NULL,
	`sender` text NOT NULL,
	`text` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_session` ON `messages` (`session`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL,
	`admin` integer DEFAULT 0
);
