CREATE TABLE matchlove_email_settings(user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,likes INTEGER NOT NULL DEFAULT 0,messages INTEGER NOT NULL DEFAULT 0);
CREATE TABLE matchlove_email_outbox(id TEXT PRIMARY KEY,user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,created INTEGER NOT NULL,next_attempt INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,sent INTEGER);
CREATE INDEX matchlove_email_pending ON matchlove_email_outbox(sent,next_attempt);
