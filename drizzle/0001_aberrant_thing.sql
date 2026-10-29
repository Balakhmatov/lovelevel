CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_accounts_email_unique` ON `auth_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `auth_limits` (
	`key` text NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`key`, `bucket`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`account`) REFERENCES `auth_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
