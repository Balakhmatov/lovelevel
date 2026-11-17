ALTER TABLE auth_accounts ADD COLUMN gender TEXT CHECK (gender IN ('male','female'));
