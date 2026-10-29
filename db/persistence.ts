import { ExecuteStatementCommand, RDSDataClient, type SqlParameter } from "@aws-sdk/client-rds-data";
import { normalizeLocale, translationTargets } from "../lib/languages.mjs";
import { blendRating } from "../lib/rating-blend.mjs";

export type RuntimeEnv = {
  DB?: D1Database;
  AWS_REGION?: string;
  AURORA_CLUSTER_ARN?: string;
  AURORA_SECRET_ARN?: string;
  AURORA_DATABASE?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
};

export type IdeaInput = {
  title: string;
  problem: string;
  solution: string;
  ideaType: "reform" | "platform";
  visibility: "public" | "restricted";
  safetyStatus: "clear" | "legal_review";
  safetyReason: string | null;
  ministry: string;
  sectors: string[];
  tags: string[];
  feasibility: number;
  feasibilityConfidence: number;
  feasibilityBasis: string;
  potential: number;
  urgency: number;
  urgencyConfidence: number;
  urgencyBasis: string;
  acceptability: number;
  acceptanceConfidence: number;
  acceptanceBasis: string;
  ownerKeyHash: string;
  submitterHash: string;
  contentHash: string;
  sourceLanguage: string;
};

function applyBlendedRatings(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const ratingCount = Number(row.community_rating_count ?? row.rating_count ?? 0);
    const aiFeasibility = Number(row.feasibility ?? 0);
    const aiPotential = Number(row.potential ?? 0);
    const aiUrgency = Number(row.urgency ?? 0);
    const aiAcceptability = Number(row.acceptability ?? 0);
    return {
      ...row,
      ai_feasibility: aiFeasibility,
      ai_potential: aiPotential,
      ai_urgency: aiUrgency,
      ai_acceptability: aiAcceptability,
      feasibility: blendRating(aiFeasibility, row.community_feasibility, ratingCount),
      potential: blendRating(aiPotential, row.community_potential, ratingCount),
      urgency: blendRating(aiUrgency, row.community_urgency, ratingCount),
      acceptability: blendRating(aiAcceptability, row.community_support, ratingCount),
    };
  });
}

const createIdeasD1 = `CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, problem TEXT NOT NULL, solution TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'sr-Latn',
  idea_type TEXT NOT NULL DEFAULT 'reform' CHECK (idea_type IN ('reform', 'platform')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'restricted')),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  safety_status TEXT NOT NULL DEFAULT 'clear' CHECK (safety_status IN ('clear', 'legal_review')),
  safety_reason TEXT, ministry TEXT, sectors TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]',
  feasibility REAL, feasibility_confidence REAL, feasibility_basis TEXT, potential REAL,
  urgency REAL, urgency_confidence REAL, urgency_basis TEXT, acceptability REAL,
  acceptance_confidence REAL, acceptance_basis TEXT, analysis_source TEXT, votes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)`;

const createTranslationsD1 = `CREATE TABLE IF NOT EXISTS idea_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, idea_id INTEGER NOT NULL, language_code TEXT NOT NULL,
  title TEXT, problem TEXT, solution TEXT, ministry TEXT, sectors TEXT, tags TEXT,
  feasibility_basis TEXT, urgency_basis TEXT, acceptance_basis TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  model TEXT, source_hash TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE, UNIQUE(idea_id, language_code)
)`;

const createVotesD1 = `CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, idea_id INTEGER NOT NULL, voter_key TEXT NOT NULL,
  feasibility_rating INTEGER, potential_rating INTEGER, urgency_rating INTEGER, support_rating INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE, UNIQUE(idea_id, voter_key)
)`;

const createQueueD1 = `CREATE TABLE IF NOT EXISTS idea_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT, idea_id INTEGER NOT NULL UNIQUE,
  owner_key_hash TEXT NOT NULL, submitter_hash TEXT NOT NULL, content_hash TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'queued' CHECK (processing_status IN ('queued', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
  UNIQUE(owner_key_hash, content_hash)
)`;

const createAttemptsD1 = `CREATE TABLE IF NOT EXISTS submission_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, owner_key_hash TEXT NOT NULL,
  submitter_hash TEXT NOT NULL, created_at TEXT NOT NULL
)`;

const createCommentsD1 = `CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, idea_id INTEGER NOT NULL, body TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'sr-Latn', author_key_hash TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT, created_at TEXT NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
)`;

const createAnalysisReviewsD1 = `CREATE TABLE IF NOT EXISTS analysis_review_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, idea_id INTEGER NOT NULL, requester_key_hash TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('low_feasibility', 'low_potential', 'both')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'abusive')),
  moderator_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE, UNIQUE(idea_id, requester_key_hash)
)`;

const postgresSchema = [
  `CREATE TABLE IF NOT EXISTS ideas (
    id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, problem TEXT NOT NULL, solution TEXT NOT NULL,
    source_language TEXT NOT NULL DEFAULT 'sr-Latn',
    idea_type TEXT NOT NULL DEFAULT 'reform' CHECK (idea_type IN ('reform', 'platform')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'restricted')),
    moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    safety_status TEXT NOT NULL DEFAULT 'clear' CHECK (safety_status IN ('clear', 'legal_review')),
    safety_reason TEXT, ministry TEXT, sectors JSONB NOT NULL DEFAULT '[]'::jsonb, tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    feasibility DOUBLE PRECISION, feasibility_confidence DOUBLE PRECISION, feasibility_basis TEXT,
    potential DOUBLE PRECISION, urgency DOUBLE PRECISION, urgency_confidence DOUBLE PRECISION, urgency_basis TEXT,
    acceptability DOUBLE PRECISION, acceptance_confidence DOUBLE PRECISION,
    acceptance_basis TEXT, analysis_source TEXT, votes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  "ALTER TABLE ideas ADD COLUMN IF NOT EXISTS idea_type TEXT NOT NULL DEFAULT 'reform' CHECK (idea_type IN ('reform', 'platform'))",
  "ALTER TABLE ideas ADD COLUMN IF NOT EXISTS source_language TEXT NOT NULL DEFAULT 'sr-Latn'",
  "ALTER TABLE ideas ADD COLUMN IF NOT EXISTS urgency DOUBLE PRECISION",
  "ALTER TABLE ideas ADD COLUMN IF NOT EXISTS urgency_confidence DOUBLE PRECISION",
  "ALTER TABLE ideas ADD COLUMN IF NOT EXISTS urgency_basis TEXT",
  "CREATE INDEX IF NOT EXISTS idx_ideas_public_status ON ideas (visibility, moderation_status, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS idea_translations (
    id BIGSERIAL PRIMARY KEY, idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL, title TEXT, problem TEXT, solution TEXT, ministry TEXT,
    sectors JSONB, tags JSONB, feasibility_basis TEXT, urgency_basis TEXT, acceptance_basis TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    model TEXT, source_hash TEXT, error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(idea_id, language_code)
  )`,
  "ALTER TABLE idea_translations ADD COLUMN IF NOT EXISTS ministry TEXT",
  "ALTER TABLE idea_translations ADD COLUMN IF NOT EXISTS sectors JSONB",
  "ALTER TABLE idea_translations ADD COLUMN IF NOT EXISTS tags JSONB",
  "ALTER TABLE idea_translations ADD COLUMN IF NOT EXISTS feasibility_basis TEXT",
  "ALTER TABLE idea_translations ADD COLUMN IF NOT EXISTS urgency_basis TEXT",
  "ALTER TABLE idea_translations ADD COLUMN IF NOT EXISTS acceptance_basis TEXT",
  "CREATE INDEX IF NOT EXISTS idx_idea_translations_status ON idea_translations (status, created_at)",
  `CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY, idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    body TEXT NOT NULL, language_code TEXT NOT NULL DEFAULT 'sr-Latn', author_key_hash TEXT NOT NULL,
    moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    moderation_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_comments_idea_created ON comments (idea_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_comments_author_created ON comments (author_key_hash, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS analysis_review_requests (
    id BIGSERIAL PRIMARY KEY, idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    requester_key_hash TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('low_feasibility', 'low_potential', 'both')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'abusive')),
    moderator_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(idea_id, requester_key_hash)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_analysis_reviews_status_created ON analysis_review_requests (status, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_analysis_reviews_requester_created ON analysis_review_requests (requester_key_hash, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS votes (
    id BIGSERIAL PRIMARY KEY, idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    voter_key TEXT NOT NULL, feasibility_rating INTEGER, potential_rating INTEGER, urgency_rating INTEGER, support_rating INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(idea_id, voter_key)
  )`,
  "ALTER TABLE votes ADD COLUMN IF NOT EXISTS feasibility_rating INTEGER",
  "ALTER TABLE votes ADD COLUMN IF NOT EXISTS potential_rating INTEGER",
  "ALTER TABLE votes ADD COLUMN IF NOT EXISTS urgency_rating INTEGER",
  "ALTER TABLE votes ADD COLUMN IF NOT EXISTS support_rating INTEGER",
  "ALTER TABLE votes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  `CREATE TABLE IF NOT EXISTS idea_queue (
    id BIGSERIAL PRIMARY KEY, idea_id BIGINT NOT NULL UNIQUE REFERENCES ideas(id) ON DELETE CASCADE,
    owner_key_hash TEXT NOT NULL, submitter_hash TEXT NOT NULL, content_hash TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'queued' CHECK (processing_status IN ('queued', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_key_hash, content_hash)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_idea_queue_owner_created ON idea_queue (owner_key_hash, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_idea_queue_submitter_created ON idea_queue (submitter_hash, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_idea_queue_status_created ON idea_queue (processing_status, created_at)",
  `CREATE TABLE IF NOT EXISTS submission_attempts (
    id BIGSERIAL PRIMARY KEY, owner_key_hash TEXT NOT NULL, submitter_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS idx_submission_attempts_owner_created ON submission_attempts (owner_key_hash, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_submission_attempts_submitter_created ON submission_attempts (submitter_hash, created_at DESC)",
];

function postgresConfig(runtime: RuntimeEnv) {
  const processEnv: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env;
  type StringEnvKey = Exclude<keyof RuntimeEnv, "DB">;
  const value = (key: StringEnvKey): string | undefined => runtime[key] || processEnv[key];
  const config = {
    region: value("AWS_REGION"),
    resourceArn: value("AURORA_CLUSTER_ARN"),
    secretArn: value("AURORA_SECRET_ARN"),
    database: value("AURORA_DATABASE"),
    accessKeyId: value("AWS_ACCESS_KEY_ID"),
    secretAccessKey: value("AWS_SECRET_ACCESS_KEY"),
    sessionToken: value("AWS_SESSION_TOKEN"),
  };
  return config.region && config.resourceArn && config.secretArn && config.database ? config : null;
}

function postgres(runtime: RuntimeEnv) {
  const config = postgresConfig(runtime);
  if (!config) return null;
  const credentials = config.accessKeyId && config.secretAccessKey
    ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, sessionToken: config.sessionToken }
    : undefined;
  const client = new RDSDataClient({ region: config.region, credentials });
  const execute = async (sql: string, parameters: SqlParameter[] = []) => client.send(new ExecuteStatementCommand({
    resourceArn: config.resourceArn,
    secretArn: config.secretArn,
    database: config.database,
    sql,
    parameters,
    formatRecordsAs: "JSON",
  }));
  return { execute };
}

const stringParam = (name: string, value: string | null): SqlParameter => value === null
  ? { name, value: { isNull: true } }
  : { name, value: { stringValue: value } };
const numberParam = (name: string, value: number): SqlParameter => ({ name, value: { doubleValue: value } });

export function persistenceBackend(runtime: RuntimeEnv) {
  return postgresConfig(runtime) ? "aurora-postgresql" : "d1-preview";
}

async function ensureQueueD1(database: D1Database) {
  await database.prepare(createIdeasD1).run();
  const columns = await database.prepare("PRAGMA table_info(ideas)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "source_language")) {
    await database.prepare("ALTER TABLE ideas ADD COLUMN source_language TEXT NOT NULL DEFAULT 'sr-Latn'").run();
  }
  if (!columns.results.some((column) => column.name === "idea_type")) {
    await database.prepare("ALTER TABLE ideas ADD COLUMN idea_type TEXT NOT NULL DEFAULT 'reform'").run();
  }
  for (const [name, type] of [["urgency", "REAL"], ["urgency_confidence", "REAL"], ["urgency_basis", "TEXT"]] as const) {
    if (!columns.results.some((column) => column.name === name)) {
      await database.prepare(`ALTER TABLE ideas ADD COLUMN ${name} ${type}`).run();
    }
  }
  await database.prepare(createTranslationsD1).run();
  const translationColumns = await database.prepare("PRAGMA table_info(idea_translations)").all<{ name: string }>();
  for (const [name, type] of [["ministry", "TEXT"], ["sectors", "TEXT"], ["tags", "TEXT"], ["feasibility_basis", "TEXT"], ["urgency_basis", "TEXT"], ["acceptance_basis", "TEXT"]] as const) {
    if (!translationColumns.results.some((column) => column.name === name)) {
      await database.prepare(`ALTER TABLE idea_translations ADD COLUMN ${name} ${type}`).run();
    }
  }
  await database.prepare(createQueueD1).run();
  await database.prepare(createAttemptsD1).run();
  await database.prepare(createCommentsD1).run();
  await database.prepare(createAnalysisReviewsD1).run();
  await database.prepare(createVotesD1).run();
  const voteColumns = await database.prepare("PRAGMA table_info(votes)").all<{ name: string }>();
  for (const [name, type] of [["feasibility_rating", "INTEGER"], ["potential_rating", "INTEGER"], ["urgency_rating", "INTEGER"], ["support_rating", "INTEGER"], ["updated_at", "TEXT"]] as const) {
    if (!voteColumns.results.some((column) => column.name === name)) await database.prepare(`ALTER TABLE votes ADD COLUMN ${name} ${type}`).run();
  }
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_idea_queue_owner_created ON idea_queue (owner_key_hash, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_idea_queue_submitter_created ON idea_queue (submitter_hash, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_idea_queue_status_created ON idea_queue (processing_status, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_submission_attempts_owner_created ON submission_attempts (owner_key_hash, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_submission_attempts_submitter_created ON submission_attempts (submitter_hash, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_idea_translations_status ON idea_translations (status, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_comments_idea_created ON comments (idea_id, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_comments_author_created ON comments (author_key_hash, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_analysis_reviews_status_created ON analysis_review_requests (status, created_at)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_analysis_reviews_requester_created ON analysis_review_requests (requester_key_hash, created_at)").run();
  await database.prepare("PRAGMA optimize").run();
}

export type SubmissionAllowance = { allowed: true } | { allowed: false; reason: "rapid" | "daily" | "duplicate"; retryAfterSeconds: number };

export async function checkSubmissionAllowance(runtime: RuntimeEnv, ownerKeyHash: string, submitterHash: string, contentHash: string): Promise<SubmissionAllowance> {
  const now = Date.now();
  const rapidSince = new Date(now - 10 * 60_000).toISOString();
  const dailySince = new Date(now - 24 * 60 * 60_000).toISOString();
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    await pg.execute(`INSERT INTO submission_attempts (owner_key_hash, submitter_hash, created_at)
      VALUES (:ownerKeyHash, :submitterHash, CAST(:createdAt AS timestamptz))`, [
      stringParam("ownerKeyHash", ownerKeyHash), stringParam("submitterHash", submitterHash), stringParam("createdAt", new Date(now).toISOString()),
    ]);
    await pg.execute("DELETE FROM submission_attempts WHERE created_at < NOW() - INTERVAL '2 days'");
    const result = await pg.execute(`SELECT
      COUNT(*) FILTER (WHERE owner_key_hash = :ownerKeyHash AND created_at >= CAST(:rapidSince AS timestamptz)) AS owner_rapid_count,
      COUNT(*) FILTER (WHERE submitter_hash = :submitterHash AND created_at >= CAST(:rapidSince AS timestamptz)) AS submitter_rapid_count,
      COUNT(*) FILTER (WHERE owner_key_hash = :ownerKeyHash AND created_at >= CAST(:dailySince AS timestamptz)) AS owner_daily_count,
      COUNT(*) FILTER (WHERE submitter_hash = :submitterHash AND created_at >= CAST(:dailySince AS timestamptz)) AS submitter_daily_count
      FROM submission_attempts WHERE submitter_hash = :submitterHash OR owner_key_hash = :ownerKeyHash`, [
      stringParam("rapidSince", rapidSince), stringParam("dailySince", dailySince),
      stringParam("ownerKeyHash", ownerKeyHash), stringParam("submitterHash", submitterHash),
    ]);
    const duplicateResult = await pg.execute(`SELECT COUNT(*) AS duplicate_count FROM idea_queue
      WHERE owner_key_hash = :ownerKeyHash AND content_hash = :contentHash`, [
      stringParam("ownerKeyHash", ownerKeyHash), stringParam("contentHash", contentHash),
    ]);
    const rows = result.formattedRecords ? JSON.parse(result.formattedRecords) as Array<{
      owner_rapid_count: number; submitter_rapid_count: number; owner_daily_count: number; submitter_daily_count: number;
    }> : [];
    const duplicates = duplicateResult.formattedRecords ? JSON.parse(duplicateResult.formattedRecords) as Array<{ duplicate_count: number }> : [];
    const counts = rows[0] ?? { owner_rapid_count: 0, submitter_rapid_count: 0, owner_daily_count: 0, submitter_daily_count: 0 };
    if (Number(duplicates[0]?.duplicate_count ?? 0) > 0) return { allowed: false, reason: "duplicate", retryAfterSeconds: 0 };
    if (Number(counts.owner_rapid_count) > 3 || Number(counts.submitter_rapid_count) > 15) return { allowed: false, reason: "rapid", retryAfterSeconds: 600 };
    if (Number(counts.owner_daily_count) > 12 || Number(counts.submitter_daily_count) > 60) return { allowed: false, reason: "daily", retryAfterSeconds: 86_400 };
    return { allowed: true };
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  await runtime.DB.prepare("INSERT INTO submission_attempts (owner_key_hash, submitter_hash, created_at) VALUES (?, ?, ?)")
    .bind(ownerKeyHash, submitterHash, new Date(now).toISOString()).run();
  await runtime.DB.prepare("DELETE FROM submission_attempts WHERE created_at < ?").bind(new Date(now - 2 * 24 * 60 * 60_000).toISOString()).run();
  const row = await runtime.DB.prepare(`SELECT
    SUM(CASE WHEN owner_key_hash = ? AND created_at >= ? THEN 1 ELSE 0 END) AS owner_rapid_count,
    SUM(CASE WHEN submitter_hash = ? AND created_at >= ? THEN 1 ELSE 0 END) AS submitter_rapid_count,
    SUM(CASE WHEN owner_key_hash = ? AND created_at >= ? THEN 1 ELSE 0 END) AS owner_daily_count,
    SUM(CASE WHEN submitter_hash = ? AND created_at >= ? THEN 1 ELSE 0 END) AS submitter_daily_count
    FROM submission_attempts WHERE submitter_hash = ? OR owner_key_hash = ?`)
    .bind(ownerKeyHash, rapidSince, submitterHash, rapidSince, ownerKeyHash, dailySince, submitterHash, dailySince, submitterHash, ownerKeyHash).first<{
      owner_rapid_count: number | null; submitter_rapid_count: number | null;
      owner_daily_count: number | null; submitter_daily_count: number | null;
    }>();
  const duplicate = await runtime.DB.prepare(`SELECT COUNT(*) AS duplicate_count FROM idea_queue
    WHERE owner_key_hash = ? AND content_hash = ?`).bind(ownerKeyHash, contentHash).first<{ duplicate_count: number }>();
  if ((duplicate?.duplicate_count ?? 0) > 0) return { allowed: false, reason: "duplicate", retryAfterSeconds: 0 };
  if ((row?.owner_rapid_count ?? 0) > 3 || (row?.submitter_rapid_count ?? 0) > 15) return { allowed: false, reason: "rapid", retryAfterSeconds: 600 };
  if ((row?.owner_daily_count ?? 0) > 12 || (row?.submitter_daily_count ?? 0) > 60) return { allowed: false, reason: "daily", retryAfterSeconds: 86_400 };
  return { allowed: true };
}

export async function listIdeas(runtime: RuntimeEnv, requestedLocale = "sr-Latn") {
  const locale = normalizeLocale(requestedLocale);
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    const result = await pg.execute(`SELECT i.id, i.title AS original_title, i.problem AS original_problem,
      i.solution AS original_solution,
      COALESCE(t.title, i.title) AS title, COALESCE(t.problem, i.problem) AS problem,
      COALESCE(t.solution, i.solution) AS solution, i.idea_type, COALESCE(t.ministry, i.ministry) AS ministry,
      COALESCE(t.sectors, i.sectors) AS sectors, COALESCE(t.tags, i.tags) AS tags,
      i.feasibility, i.feasibility_confidence, COALESCE(t.feasibility_basis, i.feasibility_basis) AS feasibility_basis,
      i.potential, i.urgency, i.urgency_confidence, COALESCE(t.urgency_basis, i.urgency_basis) AS urgency_basis,
      i.acceptability, i.acceptance_confidence,
      COALESCE(t.acceptance_basis, i.acceptance_basis) AS acceptance_basis, i.votes, i.created_at, i.source_language,
      COALESCE(c.rating_count, 0) AS community_rating_count, c.community_feasibility, c.community_potential,
      c.community_urgency, c.community_support,
      CASE WHEN t.status = 'completed' THEN :locale ELSE i.source_language END AS displayed_language,
      (t.status = 'completed' AND t.language_code <> i.source_language) AS translation_available,
      COALESCE(t.status, CASE WHEN i.source_language = :locale THEN 'completed' ELSE 'queued' END) AS translation_status
      FROM ideas i LEFT JOIN idea_translations t
        ON t.idea_id = i.id AND t.language_code = :locale AND t.status = 'completed'
      LEFT JOIN (SELECT idea_id, COUNT(*) AS rating_count,
        ROUND(AVG(feasibility_rating)::numeric, 2)::double precision AS community_feasibility,
        ROUND(AVG(potential_rating)::numeric, 2)::double precision AS community_potential,
        ROUND(AVG(urgency_rating)::numeric, 2)::double precision AS community_urgency,
        ROUND(AVG(support_rating)::numeric, 2)::double precision AS community_support
        FROM votes WHERE feasibility_rating IS NOT NULL GROUP BY idea_id) c ON c.idea_id = i.id
      WHERE i.visibility = 'public' AND i.moderation_status = 'approved'
        AND (i.feasibility IS NULL OR i.feasibility > 1)
        AND (i.potential IS NULL OR i.potential > 2)
        AND NOT EXISTS (SELECT 1 FROM idea_translations pending WHERE pending.idea_id = i.id AND pending.status <> 'completed')
      ORDER BY i.votes DESC, i.created_at DESC LIMIT 100`, [stringParam("locale", locale)]);
    const rows = result.formattedRecords ? JSON.parse(result.formattedRecords) as Array<Record<string, unknown>> : [];
    return applyBlendedRatings(rows);
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  await runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ideas_public_status ON ideas (visibility, moderation_status, created_at)").run();
  const result = await runtime.DB.prepare(`SELECT i.id, i.title AS original_title, i.problem AS original_problem,
    i.solution AS original_solution,
    COALESCE(t.title, i.title) AS title, COALESCE(t.problem, i.problem) AS problem,
    COALESCE(t.solution, i.solution) AS solution, i.idea_type, COALESCE(t.ministry, i.ministry) AS ministry,
    COALESCE(t.sectors, i.sectors) AS sectors, COALESCE(t.tags, i.tags) AS tags,
    i.feasibility, i.feasibility_confidence, COALESCE(t.feasibility_basis, i.feasibility_basis) AS feasibility_basis,
    i.potential, i.urgency, i.urgency_confidence, COALESCE(t.urgency_basis, i.urgency_basis) AS urgency_basis,
    i.acceptability, i.acceptance_confidence,
    COALESCE(t.acceptance_basis, i.acceptance_basis) AS acceptance_basis, i.votes, i.created_at, i.source_language,
    COALESCE(c.rating_count, 0) AS community_rating_count, c.community_feasibility, c.community_potential,
    c.community_urgency, c.community_support,
    CASE WHEN t.status = 'completed' THEN ? ELSE i.source_language END AS displayed_language,
    CASE WHEN t.status = 'completed' AND t.language_code <> i.source_language THEN 1 ELSE 0 END AS translation_available,
    COALESCE(t.status, CASE WHEN i.source_language = ? THEN 'completed' ELSE 'queued' END) AS translation_status
    FROM ideas i LEFT JOIN idea_translations t
      ON t.idea_id = i.id AND t.language_code = ? AND t.status = 'completed'
    LEFT JOIN (SELECT idea_id, COUNT(*) AS rating_count,
      ROUND(AVG(feasibility_rating), 2) AS community_feasibility,
      ROUND(AVG(potential_rating), 2) AS community_potential,
      ROUND(AVG(urgency_rating), 2) AS community_urgency,
      ROUND(AVG(support_rating), 2) AS community_support
      FROM votes WHERE feasibility_rating IS NOT NULL GROUP BY idea_id) c ON c.idea_id = i.id
    WHERE i.visibility = 'public' AND i.moderation_status = 'approved'
      AND (i.feasibility IS NULL OR i.feasibility > 1)
      AND (i.potential IS NULL OR i.potential > 2)
      AND NOT EXISTS (SELECT 1 FROM idea_translations pending WHERE pending.idea_id = i.id AND pending.status <> 'completed')
    ORDER BY i.votes DESC, i.created_at DESC LIMIT 100`).bind(locale, locale, locale).all();
  return applyBlendedRatings(result.results as Array<Record<string, unknown>>);
}

async function seedTranslationsPostgres(
  pg: NonNullable<ReturnType<typeof postgres>>,
  ideaId: number,
  idea: IdeaInput,
  sourceLanguage: string,
  now: string,
) {
  await pg.execute(`INSERT INTO idea_translations
    (idea_id, language_code, title, problem, solution, ministry, sectors, tags, feasibility_basis, urgency_basis, acceptance_basis,
      status, model, source_hash, created_at, updated_at)
    VALUES (:ideaId, :language, :title, :problem, :solution, :ministry, CAST(:sectors AS jsonb), CAST(:tags AS jsonb),
      :feasibilityBasis, :urgencyBasis, :acceptanceBasis, 'completed', 'original', :sourceHash,
      CAST(:createdAt AS timestamptz), CAST(:createdAt AS timestamptz))
    ON CONFLICT (idea_id, language_code) DO NOTHING`, [
    { name: "ideaId", value: { longValue: ideaId } }, stringParam("language", sourceLanguage),
    stringParam("title", idea.title), stringParam("problem", idea.problem), stringParam("solution", idea.solution),
    stringParam("ministry", idea.ministry), stringParam("sectors", JSON.stringify(idea.sectors)), stringParam("tags", JSON.stringify(idea.tags)),
    stringParam("feasibilityBasis", idea.feasibilityBasis), stringParam("urgencyBasis", idea.urgencyBasis), stringParam("acceptanceBasis", idea.acceptanceBasis),
    stringParam("sourceHash", idea.contentHash), stringParam("createdAt", now),
  ]);
  for (const language of translationTargets(sourceLanguage)) {
    await pg.execute(`INSERT INTO idea_translations
      (idea_id, language_code, status, source_hash, created_at, updated_at)
      VALUES (:ideaId, :language, 'queued', :sourceHash, CAST(:createdAt AS timestamptz), CAST(:createdAt AS timestamptz))
      ON CONFLICT (idea_id, language_code) DO NOTHING`, [
      { name: "ideaId", value: { longValue: ideaId } }, stringParam("language", language),
      stringParam("sourceHash", idea.contentHash), stringParam("createdAt", now),
    ]);
  }
}

async function seedTranslationsD1(database: D1Database, ideaId: number, idea: IdeaInput, sourceLanguage: string, now: string) {
  await database.prepare(`INSERT OR IGNORE INTO idea_translations
    (idea_id, language_code, title, problem, solution, ministry, sectors, tags, feasibility_basis, urgency_basis, acceptance_basis,
      status, model, source_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'original', ?, ?, ?)`)
    .bind(ideaId, sourceLanguage, idea.title, idea.problem, idea.solution, idea.ministry,
      JSON.stringify(idea.sectors), JSON.stringify(idea.tags), idea.feasibilityBasis, idea.urgencyBasis, idea.acceptanceBasis,
      idea.contentHash, now, now).run();
  for (const language of translationTargets(sourceLanguage)) {
    await database.prepare(`INSERT OR IGNORE INTO idea_translations
      (idea_id, language_code, status, source_hash, created_at, updated_at)
      VALUES (?, ?, 'queued', ?, ?, ?)`)
      .bind(ideaId, language, idea.contentHash, now, now).run();
  }
}

export type IdeaTranslationInput = {
  ideaId: number;
  languageCode: string;
  title: string;
  problem: string;
  solution: string;
  ministry: string;
  sectors: string[];
  tags: string[];
  feasibilityBasis: string;
  urgencyBasis: string;
  acceptanceBasis: string;
  model: string;
  sourceHash: string;
};

/** Called by the Llama worker after it preserves names, citations and legal terminology. */
export async function saveIdeaTranslation(runtime: RuntimeEnv, translation: IdeaTranslationInput) {
  const language = normalizeLocale(translation.languageCode);
  const now = new Date().toISOString();
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    await pg.execute(`INSERT INTO idea_translations
      (idea_id, language_code, title, problem, solution, ministry, sectors, tags, feasibility_basis, urgency_basis, acceptance_basis,
        status, model, source_hash, created_at, updated_at)
      VALUES (:ideaId, :language, :title, :problem, :solution, :ministry, CAST(:sectors AS jsonb), CAST(:tags AS jsonb),
        :feasibilityBasis, :urgencyBasis, :acceptanceBasis, 'completed', :model, :sourceHash, NOW(), NOW())
      ON CONFLICT (idea_id, language_code) DO UPDATE SET title = EXCLUDED.title, problem = EXCLUDED.problem,
        solution = EXCLUDED.solution, ministry = EXCLUDED.ministry, sectors = EXCLUDED.sectors, tags = EXCLUDED.tags,
        feasibility_basis = EXCLUDED.feasibility_basis, urgency_basis = EXCLUDED.urgency_basis, acceptance_basis = EXCLUDED.acceptance_basis,
        status = 'completed', model = EXCLUDED.model,
        source_hash = EXCLUDED.source_hash, error = NULL, updated_at = NOW()`, [
      { name: "ideaId", value: { longValue: translation.ideaId } }, stringParam("language", language),
      stringParam("title", translation.title), stringParam("problem", translation.problem), stringParam("solution", translation.solution),
      stringParam("ministry", translation.ministry), stringParam("sectors", JSON.stringify(translation.sectors)), stringParam("tags", JSON.stringify(translation.tags)),
      stringParam("feasibilityBasis", translation.feasibilityBasis), stringParam("urgencyBasis", translation.urgencyBasis), stringParam("acceptanceBasis", translation.acceptanceBasis),
      stringParam("model", translation.model), stringParam("sourceHash", translation.sourceHash),
    ]);
    return;
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  await runtime.DB.prepare(`INSERT INTO idea_translations
    (idea_id, language_code, title, problem, solution, ministry, sectors, tags, feasibility_basis, urgency_basis, acceptance_basis,
      status, model, source_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
    ON CONFLICT(idea_id, language_code) DO UPDATE SET title = excluded.title, problem = excluded.problem,
      solution = excluded.solution, ministry = excluded.ministry, sectors = excluded.sectors, tags = excluded.tags,
      feasibility_basis = excluded.feasibility_basis, urgency_basis = excluded.urgency_basis, acceptance_basis = excluded.acceptance_basis,
      status = 'completed', model = excluded.model,
      source_hash = excluded.source_hash, error = NULL, updated_at = excluded.updated_at`)
    .bind(translation.ideaId, language, translation.title, translation.problem, translation.solution,
      translation.ministry, JSON.stringify(translation.sectors), JSON.stringify(translation.tags),
      translation.feasibilityBasis, translation.urgencyBasis, translation.acceptanceBasis, translation.model, translation.sourceHash, now, now).run();
}

export async function listComments(runtime: RuntimeEnv, ideaId: number) {
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    const result = await pg.execute(`SELECT c.id, c.body, c.language_code, c.created_at
      FROM comments c JOIN ideas i ON i.id = c.idea_id
      WHERE c.idea_id = :ideaId AND c.moderation_status = 'approved'
        AND i.visibility = 'public' AND i.moderation_status = 'approved'
        AND NOT EXISTS (SELECT 1 FROM idea_translations pending WHERE pending.idea_id = i.id AND pending.status <> 'completed')
      ORDER BY c.created_at ASC LIMIT 500`, [{ name: "ideaId", value: { longValue: ideaId } }]);
    return result.formattedRecords ? JSON.parse(result.formattedRecords) : [];
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  const result = await runtime.DB.prepare(`SELECT c.id, c.body, c.language_code, c.created_at
    FROM comments c JOIN ideas i ON i.id = c.idea_id
    WHERE c.idea_id = ? AND c.moderation_status = 'approved'
      AND i.visibility = 'public' AND i.moderation_status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM idea_translations pending WHERE pending.idea_id = i.id AND pending.status <> 'completed')
    ORDER BY c.created_at ASC LIMIT 500`).bind(ideaId).all();
  return result.results;
}

export async function createComment(runtime: RuntimeEnv, input: {
  ideaId: number; body: string; languageCode: string; authorKeyHash: string;
  moderationStatus: "approved" | "pending"; moderationReason: string | null;
}) {
  const language = normalizeLocale(input.languageCode);
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    const countResult = await pg.execute(`SELECT COUNT(*) AS count FROM comments
      WHERE author_key_hash = :author AND created_at >= CAST(:since AS timestamptz)`, [
      stringParam("author", input.authorKeyHash), stringParam("since", since),
    ]);
    const counts = countResult.formattedRecords ? JSON.parse(countResult.formattedRecords) as Array<{ count: number }> : [];
    if (Number(counts[0]?.count ?? 0) >= 5) return { status: "rate_limited" as const };
    const result = await pg.execute(`INSERT INTO comments
      (idea_id, body, language_code, author_key_hash, moderation_status, moderation_reason)
      SELECT :ideaId, :body, :language, :author, :status, :reason FROM ideas
      WHERE id = :ideaId AND visibility = 'public' AND moderation_status = 'approved'
        AND NOT EXISTS (SELECT 1 FROM idea_translations pending WHERE pending.idea_id = ideas.id AND pending.status <> 'completed')
      RETURNING id`, [
      { name: "ideaId", value: { longValue: input.ideaId } }, stringParam("body", input.body),
      stringParam("language", language), stringParam("author", input.authorKeyHash),
      stringParam("status", input.moderationStatus), stringParam("reason", input.moderationReason),
    ]);
    const rows = result.formattedRecords ? JSON.parse(result.formattedRecords) as Array<{ id: number }> : [];
    return rows[0]?.id ? { status: input.moderationStatus as "approved" | "pending", id: rows[0].id } : { status: "not_found" as const };
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  const count = await runtime.DB.prepare("SELECT COUNT(*) AS count FROM comments WHERE author_key_hash = ? AND created_at >= ?")
    .bind(input.authorKeyHash, since).first<{ count: number }>();
  if ((count?.count ?? 0) >= 5) return { status: "rate_limited" as const };
  const idea = await runtime.DB.prepare(`SELECT id FROM ideas WHERE id = ? AND visibility = 'public' AND moderation_status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM idea_translations pending WHERE pending.idea_id = ideas.id AND pending.status <> 'completed')`)
    .bind(input.ideaId).first<{ id: number }>();
  if (!idea) return { status: "not_found" as const };
  const result = await runtime.DB.prepare(`INSERT INTO comments
    (idea_id, body, language_code, author_key_hash, moderation_status, moderation_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.ideaId, input.body, language, input.authorKeyHash, input.moderationStatus, input.moderationReason, new Date().toISOString()).run();
  return { status: input.moderationStatus as "approved" | "pending", id: Number(result.meta.last_row_id) };
}

export async function createAnalysisReviewRequest(runtime: RuntimeEnv, input: { ideaId: number; requesterKeyHash: string }) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    const ideaResult = await pg.execute(`SELECT feasibility, potential FROM ideas
      WHERE id = :ideaId AND visibility = 'public' AND moderation_status = 'approved'`, [
      { name: "ideaId", value: { longValue: input.ideaId } },
    ]);
    const ideas = ideaResult.formattedRecords ? JSON.parse(ideaResult.formattedRecords) as Array<{ feasibility: number; potential: number }> : [];
    const idea = ideas[0];
    if (!idea) return { status: "not_found" as const };
    const lowFeasibility = Number(idea.feasibility) <= 1;
    const lowPotential = Number(idea.potential) <= 2;
    if (!lowFeasibility && !lowPotential) return { status: "not_eligible" as const };
    const countResult = await pg.execute(`SELECT COUNT(*) AS count FROM analysis_review_requests
      WHERE requester_key_hash = :requester AND created_at >= CAST(:since AS timestamptz)`, [
      stringParam("requester", input.requesterKeyHash), stringParam("since", since),
    ]);
    const counts = countResult.formattedRecords ? JSON.parse(countResult.formattedRecords) as Array<{ count: number }> : [];
    if (Number(counts[0]?.count ?? 0) >= 3) return { status: "rate_limited" as const };
    const reason = lowFeasibility && lowPotential ? "both" : lowFeasibility ? "low_feasibility" : "low_potential";
    const inserted = await pg.execute(`INSERT INTO analysis_review_requests (idea_id, requester_key_hash, reason)
      VALUES (:ideaId, :requester, :reason) ON CONFLICT (idea_id, requester_key_hash) DO NOTHING RETURNING id`, [
      { name: "ideaId", value: { longValue: input.ideaId } }, stringParam("requester", input.requesterKeyHash), stringParam("reason", reason),
    ]);
    const rows = inserted.formattedRecords ? JSON.parse(inserted.formattedRecords) as Array<{ id: number }> : [];
    return rows[0]?.id ? { status: "created" as const, id: rows[0].id } : { status: "duplicate" as const };
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  const idea = await runtime.DB.prepare(`SELECT feasibility, potential FROM ideas
    WHERE id = ? AND visibility = 'public' AND moderation_status = 'approved'`)
    .bind(input.ideaId).first<{ feasibility: number; potential: number }>();
  if (!idea) return { status: "not_found" as const };
  const lowFeasibility = Number(idea.feasibility) <= 1;
  const lowPotential = Number(idea.potential) <= 2;
  if (!lowFeasibility && !lowPotential) return { status: "not_eligible" as const };
  const count = await runtime.DB.prepare(`SELECT COUNT(*) AS count FROM analysis_review_requests
    WHERE requester_key_hash = ? AND created_at >= ?`).bind(input.requesterKeyHash, since).first<{ count: number }>();
  if ((count?.count ?? 0) >= 3) return { status: "rate_limited" as const };
  const duplicate = await runtime.DB.prepare(`SELECT id FROM analysis_review_requests WHERE idea_id = ? AND requester_key_hash = ?`)
    .bind(input.ideaId, input.requesterKeyHash).first<{ id: number }>();
  if (duplicate) return { status: "duplicate" as const };
  const reason = lowFeasibility && lowPotential ? "both" : lowFeasibility ? "low_feasibility" : "low_potential";
  const now = new Date().toISOString();
  const inserted = await runtime.DB.prepare(`INSERT INTO analysis_review_requests
    (idea_id, requester_key_hash, reason, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)`)
    .bind(input.ideaId, input.requesterKeyHash, reason, now, now).run();
  return { status: "created" as const, id: Number(inserted.meta.last_row_id) };
}

export async function createIdea(runtime: RuntimeEnv, idea: IdeaInput) {
  const now = new Date().toISOString();
  const sourceLanguage = normalizeLocale(idea.sourceLanguage);
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    const parameters: SqlParameter[] = [
      stringParam("title", idea.title), stringParam("problem", idea.problem), stringParam("solution", idea.solution), stringParam("ideaType", idea.ideaType),
      stringParam("sourceLanguage", sourceLanguage),
      stringParam("visibility", idea.visibility), stringParam("safetyStatus", idea.safetyStatus),
      stringParam("safetyReason", idea.safetyReason), stringParam("ministry", idea.ministry),
      stringParam("sectors", JSON.stringify(idea.sectors)), stringParam("tags", JSON.stringify(idea.tags)),
      numberParam("feasibility", idea.feasibility), numberParam("feasibilityConfidence", idea.feasibilityConfidence),
      stringParam("feasibilityBasis", idea.feasibilityBasis), numberParam("potential", idea.potential),
      numberParam("urgency", idea.urgency), numberParam("urgencyConfidence", idea.urgencyConfidence), stringParam("urgencyBasis", idea.urgencyBasis),
      numberParam("acceptability", idea.acceptability), numberParam("acceptanceConfidence", idea.acceptanceConfidence),
      stringParam("acceptanceBasis", idea.acceptanceBasis), stringParam("createdAt", now),
    ];
    const result = await pg.execute(`INSERT INTO ideas
      (title, problem, solution, idea_type, source_language, visibility, moderation_status, safety_status, safety_reason, ministry, sectors, tags,
       feasibility, feasibility_confidence, feasibility_basis, potential, urgency, urgency_confidence, urgency_basis, acceptability, acceptance_confidence,
       acceptance_basis, analysis_source, votes, created_at)
      VALUES (:title, :problem, :solution, :ideaType, :sourceLanguage, :visibility, 'pending', :safetyStatus, :safetyReason, :ministry,
       CAST(:sectors AS jsonb), CAST(:tags AS jsonb), :feasibility, :feasibilityConfidence, :feasibilityBasis,
       :potential, :urgency, :urgencyConfidence, :urgencyBasis, :acceptability, :acceptanceConfidence, :acceptanceBasis, 'serbia-context-fallback-v2', 0,
       CAST(:createdAt AS timestamptz)) RETURNING id`, parameters);
    const rows = result.formattedRecords ? JSON.parse(result.formattedRecords) as Array<{ id: number }> : [];
    const id = rows[0]?.id;
    if (!id) throw new Error("Idea insert did not return an id");
    await seedTranslationsPostgres(pg, id, idea, sourceLanguage, now);
    await pg.execute(`INSERT INTO idea_queue
      (idea_id, owner_key_hash, submitter_hash, content_hash, processing_status, attempts, created_at, updated_at)
      VALUES (:ideaId, :ownerKeyHash, :submitterHash, :contentHash, 'queued', 0, CAST(:createdAt AS timestamptz), CAST(:createdAt AS timestamptz))`, [
      { name: "ideaId", value: { longValue: id } }, stringParam("ownerKeyHash", idea.ownerKeyHash),
      stringParam("submitterHash", idea.submitterHash), stringParam("contentHash", idea.contentHash), stringParam("createdAt", now),
    ]);
    const positionResult = await pg.execute(`SELECT 1 + COUNT(*) AS queue_position FROM idea_queue
      WHERE processing_status = 'queued' AND created_at < CAST(:createdAt AS timestamptz)`, [stringParam("createdAt", now)]);
    const positions = positionResult.formattedRecords ? JSON.parse(positionResult.formattedRecords) as Array<{ queue_position: number }> : [];
    return { id, queuePosition: Number(positions[0]?.queue_position ?? 1) };
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  const result = await runtime.DB.prepare(`INSERT INTO ideas
    (title, problem, solution, idea_type, source_language, visibility, moderation_status, safety_status, safety_reason, ministry, sectors, tags,
     feasibility, feasibility_confidence, feasibility_basis, potential, urgency, urgency_confidence, urgency_basis, acceptability, acceptance_confidence,
     acceptance_basis, analysis_source, votes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'serbia-context-fallback-v2', 0, ?)`)
    .bind(idea.title, idea.problem, idea.solution, idea.ideaType, sourceLanguage, idea.visibility, idea.safetyStatus, idea.safetyReason, idea.ministry,
      JSON.stringify(idea.sectors), JSON.stringify(idea.tags), idea.feasibility, idea.feasibilityConfidence,
      idea.feasibilityBasis, idea.potential, idea.urgency, idea.urgencyConfidence, idea.urgencyBasis,
      idea.acceptability, idea.acceptanceConfidence, idea.acceptanceBasis, now).run();
  const id = Number(result.meta.last_row_id);
  await seedTranslationsD1(runtime.DB, id, idea, sourceLanguage, now);
  await runtime.DB.prepare(`INSERT INTO idea_queue
    (idea_id, owner_key_hash, submitter_hash, content_hash, processing_status, attempts, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'queued', 0, ?, ?)`)
    .bind(id, idea.ownerKeyHash, idea.submitterHash, idea.contentHash, now, now).run();
  const position = await runtime.DB.prepare(`SELECT 1 + COUNT(*) AS queue_position FROM idea_queue
    WHERE processing_status = 'queued' AND created_at < ?`).bind(now).first<{ queue_position: number }>();
  return { id, queuePosition: Number(position?.queue_position ?? 1) };
}

export async function listMyIdeas(runtime: RuntimeEnv, ownerKeyHash: string) {
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    const result = await pg.execute(`SELECT i.id, i.title, i.problem, i.idea_type, i.visibility, i.moderation_status,
      i.ministry, i.feasibility, i.feasibility_basis, i.potential, i.urgency, i.urgency_basis,
      i.acceptability, i.created_at, q.processing_status, q.updated_at,
      CASE WHEN q.processing_status = 'queued' THEN 1 + (
        SELECT COUNT(*) FROM idea_queue earlier
        WHERE earlier.processing_status = 'queued' AND earlier.created_at < q.created_at
      ) ELSE NULL END AS queue_position
      FROM idea_queue q JOIN ideas i ON i.id = q.idea_id
      WHERE q.owner_key_hash = :ownerKeyHash ORDER BY q.created_at DESC LIMIT 100`, [stringParam("ownerKeyHash", ownerKeyHash)]);
    return result.formattedRecords ? JSON.parse(result.formattedRecords) : [];
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await ensureQueueD1(runtime.DB);
  const result = await runtime.DB.prepare(`SELECT i.id, i.title, i.problem, i.idea_type, i.visibility, i.moderation_status,
    i.ministry, i.feasibility, i.feasibility_basis, i.potential, i.urgency, i.urgency_basis,
    i.acceptability, i.created_at, q.processing_status, q.updated_at,
    CASE WHEN q.processing_status = 'queued' THEN 1 + (
      SELECT COUNT(*) FROM idea_queue earlier
      WHERE earlier.processing_status = 'queued' AND earlier.created_at < q.created_at
    ) ELSE NULL END AS queue_position
    FROM idea_queue q JOIN ideas i ON i.id = q.idea_id
    WHERE q.owner_key_hash = ? ORDER BY q.created_at DESC LIMIT 100`).bind(ownerKeyHash).all();
  return result.results;
}

export type CategoryRatings = { feasibility: number; potential: number; urgency: number; support: number };

export async function castVote(runtime: RuntimeEnv, ideaId: number, voterKey: string, ratings: CategoryRatings) {
  const pg = postgres(runtime);
  if (pg) {
    for (const statement of postgresSchema) await pg.execute(statement);
    const existingResult = await pg.execute("SELECT id FROM votes WHERE idea_id = :ideaId AND voter_key = :voterKey", [
      { name: "ideaId", value: { longValue: ideaId } }, stringParam("voterKey", voterKey),
    ]);
    const existed = Boolean(existingResult.formattedRecords && (JSON.parse(existingResult.formattedRecords) as unknown[]).length);
    const saved = await pg.execute(`INSERT INTO votes
      (idea_id, voter_key, feasibility_rating, potential_rating, urgency_rating, support_rating, created_at, updated_at)
      SELECT :ideaId, :voterKey, :feasibility, :potential, :urgency, :support, NOW(), NOW() FROM ideas
      WHERE id = :ideaId AND visibility = 'public' AND moderation_status = 'approved'
      ON CONFLICT (idea_id, voter_key) DO UPDATE SET feasibility_rating = EXCLUDED.feasibility_rating,
        potential_rating = EXCLUDED.potential_rating, urgency_rating = EXCLUDED.urgency_rating,
        support_rating = EXCLUDED.support_rating, updated_at = NOW() RETURNING id`, [
      { name: "ideaId", value: { longValue: ideaId } }, stringParam("voterKey", voterKey),
      numberParam("feasibility", ratings.feasibility), numberParam("potential", ratings.potential),
      numberParam("urgency", ratings.urgency), numberParam("support", ratings.support),
    ]);
    const savedRows = saved.formattedRecords ? JSON.parse(saved.formattedRecords) as unknown[] : [];
    if (!savedRows.length) return { status: "not_found" as const };
    if (!existed) await pg.execute("UPDATE ideas SET votes = votes + 1 WHERE id = :ideaId", [{ name: "ideaId", value: { longValue: ideaId } }]);
    const aggregate = await pg.execute(`SELECT i.votes, i.feasibility, i.potential, i.urgency, i.acceptability,
      COUNT(v.id) AS rating_count, ROUND(AVG(v.feasibility_rating)::numeric, 2)::double precision AS community_feasibility,
      ROUND(AVG(v.potential_rating)::numeric, 2)::double precision AS community_potential,
      ROUND(AVG(v.urgency_rating)::numeric, 2)::double precision AS community_urgency,
      ROUND(AVG(v.support_rating)::numeric, 2)::double precision AS community_support FROM ideas i JOIN votes v ON v.idea_id = i.id
      WHERE i.id = :ideaId GROUP BY i.id, i.votes, i.feasibility, i.potential, i.urgency, i.acceptability`, [{ name: "ideaId", value: { longValue: ideaId } }]);
    const aggregates = aggregate.formattedRecords ? JSON.parse(aggregate.formattedRecords) as Array<Record<string, unknown>> : [];
    const blended = applyBlendedRatings(aggregates.map((row) => ({ ...row, community_rating_count: row.rating_count })))[0];
    return { status: existed ? "updated" as const : "counted" as const, ...blended };
  }
  if (!runtime.DB) throw new Error("No persistence backend configured");
  await runtime.DB.prepare(createVotesD1).run();
  const columns = await runtime.DB.prepare("PRAGMA table_info(votes)").all<{ name: string }>();
  for (const [name, type] of [["feasibility_rating", "INTEGER"], ["potential_rating", "INTEGER"], ["urgency_rating", "INTEGER"], ["support_rating", "INTEGER"], ["updated_at", "TEXT"]] as const) {
    if (!columns.results.some((column) => column.name === name)) await runtime.DB.prepare(`ALTER TABLE votes ADD COLUMN ${name} ${type}`).run();
  }
  await runtime.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_idea_voter ON votes (idea_id, voter_key)").run();
  const idea = await runtime.DB.prepare("SELECT id FROM ideas WHERE id = ? AND visibility = 'public' AND moderation_status = 'approved'").bind(ideaId).first<{ id: number }>();
  if (!idea) return { status: "not_found" as const };
  const existing = await runtime.DB.prepare("SELECT id FROM votes WHERE idea_id = ? AND voter_key = ?").bind(ideaId, voterKey).first<{ id: number }>();
  const now = new Date().toISOString();
  if (existing) {
    await runtime.DB.prepare(`UPDATE votes SET feasibility_rating = ?, potential_rating = ?, urgency_rating = ?, support_rating = ?, updated_at = ?
      WHERE id = ?`).bind(ratings.feasibility, ratings.potential, ratings.urgency, ratings.support, now, existing.id).run();
  } else {
    await runtime.DB.prepare(`INSERT INTO votes
      (idea_id, voter_key, feasibility_rating, potential_rating, urgency_rating, support_rating, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(ideaId, voterKey, ratings.feasibility, ratings.potential, ratings.urgency, ratings.support, now, now).run();
    await runtime.DB.prepare("UPDATE ideas SET votes = votes + 1 WHERE id = ?").bind(ideaId).run();
  }
  const aggregate = await runtime.DB.prepare(`SELECT i.votes, i.feasibility, i.potential, i.urgency, i.acceptability,
    COUNT(v.id) AS rating_count, ROUND(AVG(v.feasibility_rating), 2) AS community_feasibility,
    ROUND(AVG(v.potential_rating), 2) AS community_potential, ROUND(AVG(v.urgency_rating), 2) AS community_urgency,
    ROUND(AVG(v.support_rating), 2) AS community_support FROM ideas i JOIN votes v ON v.idea_id = i.id
    WHERE i.id = ? GROUP BY i.id, i.votes, i.feasibility, i.potential, i.urgency, i.acceptability`).bind(ideaId).first<Record<string, unknown>>();
  const blended = applyBlendedRatings(aggregate ? [{ ...aggregate, community_rating_count: aggregate.rating_count }] : [])[0];
  return { status: existing ? "updated" as const : "counted" as const, ...blended };
}
