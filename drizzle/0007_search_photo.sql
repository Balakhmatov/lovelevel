CREATE TABLE matchlove_search_photos (
 user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
 mime TEXT NOT NULL,
 data BLOB NOT NULL,
 updated TEXT NOT NULL
);
