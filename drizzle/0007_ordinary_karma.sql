ALTER TABLE `idea_translations` ADD `urgency_basis` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `urgency` real;--> statement-breakpoint
ALTER TABLE `ideas` ADD `urgency_confidence` real;--> statement-breakpoint
ALTER TABLE `ideas` ADD `urgency_basis` text;--> statement-breakpoint
ALTER TABLE `votes` ADD `feasibility_rating` integer;--> statement-breakpoint
ALTER TABLE `votes` ADD `potential_rating` integer;--> statement-breakpoint
ALTER TABLE `votes` ADD `urgency_rating` integer;--> statement-breakpoint
ALTER TABLE `votes` ADD `support_rating` integer;--> statement-breakpoint
ALTER TABLE `votes` ADD `updated_at` text;
