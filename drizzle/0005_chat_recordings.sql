CREATE TABLE `chat_media` (
	`message` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`mime` text NOT NULL,
	`duration` real NOT NULL,
	FOREIGN KEY (`message`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_settings` (
	`user` text PRIMARY KEY NOT NULL,
	`receive_video` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user` text PRIMARY KEY NOT NULL,
	`expires` text NOT NULL
);
