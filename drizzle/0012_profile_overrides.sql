CREATE TABLE matchlove_profile_overrides (
 user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
 data TEXT NOT NULL DEFAULT '{}'
);
