CREATE TABLE "analysis_review_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idea_id" bigint NOT NULL,
	"requester_key_hash" text NOT NULL,
	"reason" text NOT NULL CHECK ("reason" IN ('low_feasibility', 'low_potential', 'both')),
	"status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'confirmed', 'dismissed', 'abusive')),
	"moderator_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_review_requests" ADD CONSTRAINT "analysis_review_requests_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_analysis_reviews_idea_requester" ON "analysis_review_requests" USING btree ("idea_id","requester_key_hash");--> statement-breakpoint
CREATE INDEX "idx_analysis_reviews_status_created" ON "analysis_review_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_analysis_reviews_requester_created" ON "analysis_review_requests" USING btree ("requester_key_hash","created_at");
