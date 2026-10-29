BEGIN;

CREATE TABLE IF NOT EXISTS ideas (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'sr-Latn',
  idea_type TEXT NOT NULL DEFAULT 'reform' CHECK (idea_type IN ('reform', 'platform')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'restricted')),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  safety_status TEXT NOT NULL DEFAULT 'clear' CHECK (safety_status IN ('clear', 'legal_review')),
  safety_reason TEXT,
  ministry TEXT,
  sectors JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  feasibility DOUBLE PRECISION,
  feasibility_confidence DOUBLE PRECISION,
  feasibility_basis TEXT,
  potential DOUBLE PRECISION,
  urgency DOUBLE PRECISION,
  urgency_confidence DOUBLE PRECISION,
  urgency_basis TEXT,
  acceptability DOUBLE PRECISION,
  acceptance_confidence DOUBLE PRECISION,
  acceptance_basis TEXT,
  analysis_source TEXT,
  votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideas_public_status
  ON ideas (visibility, moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS idea_translations (
  id BIGSERIAL PRIMARY KEY,
  idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  title TEXT,
  problem TEXT,
  solution TEXT,
  ministry TEXT,
  sectors JSONB,
  tags JSONB,
  feasibility_basis TEXT,
  urgency_basis TEXT,
  acceptance_basis TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  model TEXT,
  source_hash TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_idea_translations_status
  ON idea_translations (status, created_at);

CREATE TABLE IF NOT EXISTS votes (
  id BIGSERIAL PRIMARY KEY,
  idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  feasibility_rating INTEGER,
  potential_rating INTEGER,
  urgency_rating INTEGER,
  support_rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id, voter_key)
);

CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'sr-Latn',
  author_key_hash TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_idea_created ON comments (idea_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_author_created ON comments (author_key_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS analysis_review_requests (
  id BIGSERIAL PRIMARY KEY,
  idea_id BIGINT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  requester_key_hash TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('low_feasibility', 'low_potential', 'both')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'abusive')),
  moderator_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id, requester_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_analysis_reviews_status_created
  ON analysis_review_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_reviews_requester_created
  ON analysis_review_requests (requester_key_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS idea_queue (
  id BIGSERIAL PRIMARY KEY,
  idea_id BIGINT NOT NULL UNIQUE REFERENCES ideas(id) ON DELETE CASCADE,
  owner_key_hash TEXT NOT NULL,
  submitter_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'queued' CHECK (processing_status IN ('queued', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_key_hash, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_idea_queue_owner_created ON idea_queue (owner_key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idea_queue_submitter_created ON idea_queue (submitter_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idea_queue_status_created ON idea_queue (processing_status, created_at);

CREATE TABLE IF NOT EXISTS submission_attempts (
  id BIGSERIAL PRIMARY KEY,
  owner_key_hash TEXT NOT NULL,
  submitter_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_attempts_owner_created
  ON submission_attempts (owner_key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_attempts_submitter_created
  ON submission_attempts (submitter_hash, created_at DESC);

-- Deliberately contains no account, owner key, device key, submitter hash or IP field.
CREATE TABLE IF NOT EXISTS moderator_reports (
  id BIGSERIAL PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('corruption', 'sensitive')),
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'sr-Latn',
  content_hash TEXT NOT NULL UNIQUE,
  safety_reason TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'reviewing', 'referred', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderator_reports_type_status_created
  ON moderator_reports (report_type, moderation_status, created_at DESC);

COMMIT;
