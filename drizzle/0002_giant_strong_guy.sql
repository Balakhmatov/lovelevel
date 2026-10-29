CREATE TABLE `auth_telegram_challenges` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account` text,
	`mode` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`account`) REFERENCES `auth_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_telegram_links` (
	`telegram_id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`account`) REFERENCES `auth_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_telegram_links_account_unique` ON `auth_telegram_links` (`account`);--> statement-breakpoint
CREATE TABLE `auth_telegram_proofs` (
	`hash` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
