ALTER TABLE "idea_translations" ADD COLUMN "urgency_basis" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "urgency" double precision;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "urgency_confidence" double precision;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "urgency_basis" text;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "feasibility_rating" integer;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "potential_rating" integer;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "urgency_rating" integer;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "support_rating" integer;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;