CREATE TABLE `media_metadata` (
	`media_id` text PRIMARY KEY NOT NULL,
	`duration` real NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `progression_state` (
	`user` text PRIMARY KEY NOT NULL,
	`max_level` integer DEFAULT 1 NOT NULL,
	`photo_access` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visit_days` (
	`user` text NOT NULL,
	`day` text NOT NULL,
	PRIMARY KEY(`user`, `day`)
);

-- Preserve already earned status, including imported/legacy accounts.
INSERT OR IGNORE INTO progression_state(user,max_level)
 SELECT user,CASE WHEN SUM(points)>=100 THEN 10 WHEN SUM(points)>=80 THEN 9
 WHEN SUM(points)>=65 THEN 8 WHEN SUM(points)>=50 THEN 7 WHEN SUM(points)>=35 THEN 6
 WHEN SUM(points)>=20 THEN 5 WHEN SUM(points)>=15 THEN 4 WHEN SUM(points)>=10 THEN 3
 WHEN SUM(points)>=5 THEN 2 ELSE 1 END FROM rewards GROUP BY user;
INSERT OR IGNORE INTO visit_days(user,day)
 SELECT user,substr(key,5) FROM rewards WHERE key LIKE 'day:____-__-__';
INSERT OR IGNORE INTO visit_days(user,day)
 SELECT id,date(created,'+3 hours') FROM profiles WHERE date(created,'+3 hours') IS NOT NULL;
