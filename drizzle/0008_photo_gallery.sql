CREATE TABLE matchlove_photos (
 id TEXT PRIMARY KEY,
 user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
 mime TEXT NOT NULL,
 data BLOB NOT NULL,
 is_main INTEGER NOT NULL DEFAULT 0 CHECK(is_main IN (0,1)),
 created TEXT NOT NULL
);
CREATE INDEX idx_matchlove_photos_user ON matchlove_photos(user,created,id);
CREATE UNIQUE INDEX idx_matchlove_photos_main ON matchlove_photos(user) WHERE is_main=1;
INSERT INTO matchlove_photos(id,user,mime,data,is_main,created)
 SELECT lower(hex(randomblob(16))),user,mime,data,1,updated FROM matchlove_search_photos;
DELETE FROM matchlove_search_photos;
