CREATE TABLE matchlove_locations (
 user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
 city TEXT NOT NULL DEFAULT '',
 latitude REAL,
 longitude REAL,
 updated TEXT NOT NULL,
 CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE TABLE matchlove_tag_usage (
 user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
 tag TEXT NOT NULL,
 PRIMARY KEY(user,tag)
);
CREATE INDEX idx_matchlove_tag_usage_tag ON matchlove_tag_usage(tag);
