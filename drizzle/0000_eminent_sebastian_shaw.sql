CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`sender`, `recipient`)
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`sender`, `recipient`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`key` text NOT NULL,
	`mime` text NOT NULL,
	`min` integer DEFAULT 1 NOT NULL,
	`basic` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birthdate` text NOT NULL,
	`city` text NOT NULL,
	`gender` text NOT NULL,
	`seeking` text DEFAULT 'all' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`intent` text NOT NULL,
	`interests` text DEFAULT '[]' NOT NULL,
	`created` text NOT NULL,
	`paused` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter` text NOT NULL,
	`target` text NOT NULL,
	`reason` text NOT NULL,
	`message` text,
	`created` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rewards` (
	`user` text NOT NULL,
	`key` text NOT NULL,
	`points` integer NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`user`, `key`)
);
