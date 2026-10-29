CREATE TABLE `analysis_review_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idea_id` integer NOT NULL,
	`requester_key_hash` text NOT NULL,
	`reason` text NOT NULL CHECK (`reason` IN ('low_feasibility', 'low_potential', 'both')),
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending', 'confirmed', 'dismissed', 'abusive')),
	`moderator_note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_analysis_reviews_idea_requester` ON `analysis_review_requests` (`idea_id`,`requester_key_hash`);--> statement-breakpoint
CREATE INDEX `idx_analysis_reviews_status_created` ON `analysis_review_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analysis_reviews_requester_created` ON `analysis_review_requests` (`requester_key_hash`,`created_at`);
