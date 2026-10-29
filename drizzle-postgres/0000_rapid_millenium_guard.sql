CREATE TABLE "idea_queue" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idea_id" bigint NOT NULL,
	"owner_key_hash" text NOT NULL,
	"submitter_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"processing_status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"problem" text NOT NULL,
	"solution" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"moderation_status" text DEFAULT 'pending' NOT NULL,
	"safety_status" text DEFAULT 'clear' NOT NULL,
	"safety_reason" text,
	"ministry" text,
	"sectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feasibility" double precision,
	"feasibility_confidence" double precision,
	"feasibility_basis" text,
	"potential" double precision,
	"acceptability" double precision,
	"acceptance_confidence" double precision,
	"acceptance_basis" text,
	"analysis_source" text,
	"votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_key_hash" text NOT NULL,
	"submitter_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idea_id" bigint NOT NULL,
	"voter_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_queue" ADD CONSTRAINT "idea_queue_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_idea_queue_idea" ON "idea_queue" USING btree ("idea_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_idea_queue_owner_content" ON "idea_queue" USING btree ("owner_key_hash","content_hash");--> statement-breakpoint
CREATE INDEX "idx_idea_queue_owner_created" ON "idea_queue" USING btree ("owner_key_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_idea_queue_submitter_created" ON "idea_queue" USING btree ("submitter_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_idea_queue_status_created" ON "idea_queue" USING btree ("processing_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_ideas_public_status" ON "ideas" USING btree ("visibility","moderation_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_submission_attempts_owner_created" ON "submission_attempts" USING btree ("owner_key_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_submission_attempts_submitter_created" ON "submission_attempts" USING btree ("submitter_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_votes_idea_voter" ON "votes" USING btree ("idea_id","voter_key");