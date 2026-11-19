ALTER TABLE matchlove_search_settings ADD COLUMN hide_conflicts INTEGER NOT NULL DEFAULT 0 CHECK(hide_conflicts IN (0,1));
UPDATE matchlove_search_settings SET hide_conflicts=hide_habit_conflicts;
