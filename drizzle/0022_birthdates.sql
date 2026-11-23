CREATE TABLE matchlove_birthdates(user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,birthdate TEXT NOT NULL);
