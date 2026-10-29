CREATE TABLE `ideas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`problem` text NOT NULL,
	`solution` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`moderation_status` text DEFAULT 'pending' NOT NULL,
	`ministry` text,
	`sectors` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`feasibility` real,
	`potential` real,
	`acceptability` real,
	`analysis_source` text,
	`votes` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idea_id` integer NOT NULL,
	`voter_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade
);
