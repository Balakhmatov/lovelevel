ALTER TABLE matchlove_email_outbox ADD COLUMN payload TEXT;
-- Replace old immediate notices with daily summaries; preserve sent history.
DELETE FROM matchlove_email_outbox WHERE sent IS NULL AND kind IN ('likes','messages');
CREATE TABLE matchlove_email_digest_state(
 user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
 window_end INTEGER NOT NULL,
 next_due INTEGER NOT NULL,
 last_sent INTEGER
);
CREATE INDEX matchlove_email_digest_due ON matchlove_email_digest_state(next_due);
CREATE TABLE matchlove_email_events(
 id INTEGER PRIMARY KEY,
 user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('likes','matches','messages')),
 peer TEXT,
 created INTEGER NOT NULL,
 digest TEXT REFERENCES matchlove_email_outbox(id) ON DELETE CASCADE
);
CREATE INDEX matchlove_email_events_pending ON matchlove_email_events(user,digest,created);
CREATE UNIQUE INDEX matchlove_email_one_digest ON matchlove_email_outbox(user) WHERE kind='digest' AND sent IS NULL;
