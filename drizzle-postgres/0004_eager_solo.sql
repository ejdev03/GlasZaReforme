CREATE TABLE "moderator_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"report_type" text NOT NULL,
	"title" text NOT NULL,
	"problem" text NOT NULL,
	"solution" text NOT NULL,
	"source_language" text DEFAULT 'sr-Latn' NOT NULL,
	"content_hash" text NOT NULL,
	"safety_reason" text,
	"moderation_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_moderator_reports_content_hash" ON "moderator_reports" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_moderator_reports_type_status_created" ON "moderator_reports" USING btree ("report_type","moderation_status","created_at");