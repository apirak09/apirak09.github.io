CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `limits_expiry` ON `limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `presence` (
	`key` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`player_id` text NOT NULL,
	`seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `presence_code` ON `presence` (`code`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`creator_key` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_creator_key_unique` ON `rooms` (`creator_key`);--> statement-breakpoint
CREATE INDEX `rooms_expiry` ON `rooms` (`expires_at`);