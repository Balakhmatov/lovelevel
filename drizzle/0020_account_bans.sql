CREATE TABLE matchlove_account_bans(user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,reason TEXT NOT NULL,actor TEXT NOT NULL,created TEXT NOT NULL);
