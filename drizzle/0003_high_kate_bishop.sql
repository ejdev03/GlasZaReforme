ALTER TABLE `ideas` ADD `safety_status` text DEFAULT 'clear' NOT NULL;--> statement-breakpoint
ALTER TABLE `ideas` ADD `safety_reason` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `feasibility_confidence` real;--> statement-breakpoint
ALTER TABLE `ideas` ADD `feasibility_basis` text;