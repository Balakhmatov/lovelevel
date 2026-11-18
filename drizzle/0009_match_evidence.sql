CREATE TABLE IF NOT EXISTS matchlove_ai_cache (
 viewer TEXT NOT NULL,
 candidate TEXT NOT NULL,
 viewer_updated TEXT NOT NULL,
 candidate_updated TEXT NOT NULL,
 score INTEGER NOT NULL,
 confidence INTEGER NOT NULL,
 explanation TEXT NOT NULL,
 PRIMARY KEY(viewer,candidate)
);
ALTER TABLE matchlove_ai_cache ADD COLUMN evidence TEXT;
ALTER TABLE matchlove_ai_cache ADD COLUMN scoring_version TEXT;
