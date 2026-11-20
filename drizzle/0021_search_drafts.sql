CREATE TABLE matchlove_search_drafts(user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,text TEXT NOT NULL,updated INTEGER NOT NULL);
