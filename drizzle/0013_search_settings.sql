CREATE TABLE matchlove_search_settings (
 user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
 hide_habit_conflicts INTEGER NOT NULL DEFAULT 0 CHECK(hide_habit_conflicts IN (0,1))
);
