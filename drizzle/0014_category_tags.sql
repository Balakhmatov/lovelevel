CREATE TABLE matchlove_category_tag_usage (
 user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
 category TEXT NOT NULL,
 tag TEXT NOT NULL,
 PRIMARY KEY(user,category,tag)
);
CREATE INDEX idx_matchlove_category_tags ON matchlove_category_tag_usage(category,tag);
INSERT OR IGNORE INTO matchlove_category_tag_usage(user,category,tag)
 SELECT user,'interests',tag FROM matchlove_tag_usage;
