import { bigint, bigserial, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const ideas = pgTable("ideas", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  solution: text("solution").notNull(),
  sourceLanguage: text("source_language").notNull().default("sr-Latn"),
  ideaType: text("idea_type", { enum: ["reform", "platform"] }).notNull().default("reform"),
  visibility: text("visibility", { enum: ["public", "restricted"] }).notNull().default("public"),
  moderationStatus: text("moderation_status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  safetyStatus: text("safety_status", { enum: ["clear", "legal_review"] }).notNull().default("clear"),
  safetyReason: text("safety_reason"),
  ministry: text("ministry"),
  sectors: jsonb("sectors").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  feasibility: doublePrecision("feasibility"),
  feasibilityConfidence: doublePrecision("feasibility_confidence"),
  feasibilityBasis: text("feasibility_basis"),
  potential: doublePrecision("potential"),
  urgency: doublePrecision("urgency"),
  urgencyConfidence: doublePrecision("urgency_confidence"),
  urgencyBasis: text("urgency_basis"),
  acceptability: doublePrecision("acceptability"),
  acceptanceConfidence: doublePrecision("acceptance_confidence"),
  acceptanceBasis: text("acceptance_basis"),
  analysisSource: text("analysis_source"),
  votes: integer("votes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("idx_ideas_public_status").on(table.visibility, table.moderationStatus, table.createdAt)]);

export const ideaTranslations = pgTable("idea_translations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ideaId: bigint("idea_id", { mode: "number" }).notNull().references(() => ideas.id, { onDelete: "cascade" }),
  languageCode: text("language_code").notNull(),
  title: text("title"),
  problem: text("problem"),
  solution: text("solution"),
  ministry: text("ministry"),
  sectors: jsonb("sectors").$type<string[]>(),
  tags: jsonb("tags").$type<string[]>(),
  feasibilityBasis: text("feasibility_basis"),
  urgencyBasis: text("urgency_basis"),
  acceptanceBasis: text("acceptance_basis"),
  status: text("status", { enum: ["queued", "processing", "completed", "failed"] }).notNull().default("queued"),
  model: text("model"),
  sourceHash: text("source_hash"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_idea_translations_idea_language").on(table.ideaId, table.languageCode),
  index("idx_idea_translations_status").on(table.status, table.createdAt),
]);

export const votes = pgTable("votes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ideaId: bigint("idea_id", { mode: "number" }).notNull().references(() => ideas.id, { onDelete: "cascade" }),
  voterKey: text("voter_key").notNull(),
  feasibilityRating: integer("feasibility_rating"),
  potentialRating: integer("potential_rating"),
  urgencyRating: integer("urgency_rating"),
  supportRating: integer("support_rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("idx_votes_idea_voter").on(table.ideaId, table.voterKey)]);

export const comments = pgTable("comments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ideaId: bigint("idea_id", { mode: "number" }).notNull().references(() => ideas.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  languageCode: text("language_code").notNull().default("sr-Latn"),
  authorKeyHash: text("author_key_hash").notNull(),
  moderationStatus: text("moderation_status", { enum: ["pending", "approved", "rejected"] }).notNull().default("approved"),
  moderationReason: text("moderation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_comments_idea_created").on(table.ideaId, table.createdAt),
  index("idx_comments_author_created").on(table.authorKeyHash, table.createdAt),
]);

export const analysisReviewRequests = pgTable("analysis_review_requests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ideaId: bigint("idea_id", { mode: "number" }).notNull().references(() => ideas.id, { onDelete: "cascade" }),
  requesterKeyHash: text("requester_key_hash").notNull(),
  reason: text("reason", { enum: ["low_feasibility", "low_potential", "both"] }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "dismissed", "abusive"] }).notNull().default("pending"),
  moderatorNote: text("moderator_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_analysis_reviews_idea_requester").on(table.ideaId, table.requesterKeyHash),
  index("idx_analysis_reviews_status_created").on(table.status, table.createdAt),
  index("idx_analysis_reviews_requester_created").on(table.requesterKeyHash, table.createdAt),
]);

export const ideaQueue = pgTable("idea_queue", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ideaId: bigint("idea_id", { mode: "number" }).notNull().references(() => ideas.id, { onDelete: "cascade" }),
  ownerKeyHash: text("owner_key_hash").notNull(),
  submitterHash: text("submitter_hash").notNull(),
  contentHash: text("content_hash").notNull(),
  processingStatus: text("processing_status", { enum: ["queued", "processing", "completed", "failed"] }).notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_idea_queue_idea").on(table.ideaId),
  uniqueIndex("idx_idea_queue_owner_content").on(table.ownerKeyHash, table.contentHash),
  index("idx_idea_queue_owner_created").on(table.ownerKeyHash, table.createdAt),
  index("idx_idea_queue_submitter_created").on(table.submitterHash, table.createdAt),
  index("idx_idea_queue_status_created").on(table.processingStatus, table.createdAt),
]);

export const submissionAttempts = pgTable("submission_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ownerKeyHash: text("owner_key_hash").notNull(),
  submitterHash: text("submitter_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_submission_attempts_owner_created").on(table.ownerKeyHash, table.createdAt),
  index("idx_submission_attempts_submitter_created").on(table.submitterHash, table.createdAt),
]);

export const moderatorReports = pgTable("moderator_reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  reportType: text("report_type", { enum: ["corruption", "sensitive"] }).notNull(),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  solution: text("solution").notNull(),
  sourceLanguage: text("source_language").notNull().default("sr-Latn"),
  contentHash: text("content_hash").notNull(),
  safetyReason: text("safety_reason"),
  moderationStatus: text("moderation_status", { enum: ["pending", "reviewing", "referred", "closed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_moderator_reports_content_hash").on(table.contentHash),
  index("idx_moderator_reports_type_status_created").on(table.reportType, table.moderationStatus, table.createdAt),
]);
