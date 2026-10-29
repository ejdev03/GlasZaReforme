CREATE TABLE `idea_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idea_id` integer NOT NULL,
	`owner_key_hash` text NOT NULL,
	`submitter_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`processing_status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_idea_queue_idea` ON `idea_queue` (`idea_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_idea_queue_owner_content` ON `idea_queue` (`owner_key_hash`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_idea_queue_owner_created` ON `idea_queue` (`owner_key_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_idea_queue_submitter_created` ON `idea_queue` (`submitter_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_idea_queue_status_created` ON `idea_queue` (`processing_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `submission_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_key_hash` text NOT NULL,
	`submitter_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submission_attempts_owner_created` ON `submission_attempts` (`owner_key_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_submission_attempts_submitter_created` ON `submission_attempts` (`submitter_hash`,`created_at`);