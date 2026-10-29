import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ideas = sqliteTable("ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  sectors: text("sectors").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  feasibility: real("feasibility"),
  feasibilityConfidence: real("feasibility_confidence"),
  feasibilityBasis: text("feasibility_basis"),
  potential: real("potential"),
  urgency: real("urgency"),
  urgencyConfidence: real("urgency_confidence"),
  urgencyBasis: text("urgency_basis"),
  acceptability: real("acceptability"),
  acceptanceConfidence: real("acceptance_confidence"),
  acceptanceBasis: text("acceptance_basis"),
  analysisSource: text("analysis_source"),
  votes: integer("votes").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_ideas_public_status").on(table.visibility, table.moderationStatus, table.createdAt)]);

export const ideaTranslations = sqliteTable("idea_translations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  languageCode: text("language_code").notNull(),
  title: text("title"),
  problem: text("problem"),
  solution: text("solution"),
  ministry: text("ministry"),
  sectors: text("sectors"),
  tags: text("tags"),
  feasibilityBasis: text("feasibility_basis"),
  urgencyBasis: text("urgency_basis"),
  acceptanceBasis: text("acceptance_basis"),
  status: text("status", { enum: ["queued", "processing", "completed", "failed"] }).notNull().default("queued"),
  model: text("model"),
  sourceHash: text("source_hash"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_idea_translations_idea_language").on(table.ideaId, table.languageCode),
  index("idx_idea_translations_status").on(table.status, table.createdAt),
]);

export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  voterKey: text("voter_key").notNull(),
  feasibilityRating: integer("feasibility_rating"),
  potentialRating: integer("potential_rating"),
  urgencyRating: integer("urgency_rating"),
  supportRating: integer("support_rating"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_votes_idea_voter").on(table.ideaId, table.voterKey)]);

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  languageCode: text("language_code").notNull().default("sr-Latn"),
  authorKeyHash: text("author_key_hash").notNull(),
  moderationStatus: text("moderation_status", { enum: ["pending", "approved", "rejected"] }).notNull().default("approved"),
  moderationReason: text("moderation_reason"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_comments_idea_created").on(table.ideaId, table.createdAt),
  index("idx_comments_author_created").on(table.authorKeyHash, table.createdAt),
]);

export const analysisReviewRequests = sqliteTable("analysis_review_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  requesterKeyHash: text("requester_key_hash").notNull(),
  reason: text("reason", { enum: ["low_feasibility", "low_potential", "both"] }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "dismissed", "abusive"] }).notNull().default("pending"),
  moderatorNote: text("moderator_note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_analysis_reviews_idea_requester").on(table.ideaId, table.requesterKeyHash),
  index("idx_analysis_reviews_status_created").on(table.status, table.createdAt),
  index("idx_analysis_reviews_requester_created").on(table.requesterKeyHash, table.createdAt),
]);

export const ideaQueue = sqliteTable("idea_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  ownerKeyHash: text("owner_key_hash").notNull(),
  submitterHash: text("submitter_hash").notNull(),
  contentHash: text("content_hash").notNull(),
  processingStatus: text("processing_status", { enum: ["queued", "processing", "completed", "failed"] }).notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_idea_queue_idea").on(table.ideaId),
  uniqueIndex("idx_idea_queue_owner_content").on(table.ownerKeyHash, table.contentHash),
  index("idx_idea_queue_owner_created").on(table.ownerKeyHash, table.createdAt),
  index("idx_idea_queue_submitter_created").on(table.submitterHash, table.createdAt),
  index("idx_idea_queue_status_created").on(table.processingStatus, table.createdAt),
]);

export const submissionAttempts = sqliteTable("submission_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKeyHash: text("owner_key_hash").notNull(),
  submitterHash: text("submitter_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_submission_attempts_owner_created").on(table.ownerKeyHash, table.createdAt),
  index("idx_submission_attempts_submitter_created").on(table.submitterHash, table.createdAt),
]);

export const moderatorReports = sqliteTable("moderator_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportType: text("report_type", { enum: ["corruption", "sensitive"] }).notNull(),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  solution: text("solution").notNull(),
  sourceLanguage: text("source_language").notNull().default("sr-Latn"),
  contentHash: text("content_hash").notNull(),
  safetyReason: text("safety_reason"),
  moderationStatus: text("moderation_status", { enum: ["pending", "reviewing", "referred", "closed"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_moderator_reports_content_hash").on(table.contentHash),
  index("idx_moderator_reports_type_status_created").on(table.reportType, table.moderationStatus, table.createdAt),
]);
