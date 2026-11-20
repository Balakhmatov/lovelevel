CREATE TABLE analytics_sessions (
 id TEXT PRIMARY KEY,
 visitor TEXT NOT NULL,
 user TEXT REFERENCES auth_accounts(id) ON DELETE CASCADE,
 started INTEGER NOT NULL,
 seen INTEGER NOT NULL,
 active_seconds INTEGER NOT NULL DEFAULT 0,
 source TEXT NOT NULL DEFAULT 'direct',
 medium TEXT NOT NULL DEFAULT '',
 campaign TEXT NOT NULL DEFAULT '',
 landing TEXT NOT NULL DEFAULT '/',
 page TEXT NOT NULL DEFAULT 'home'
);
CREATE INDEX analytics_sessions_started ON analytics_sessions(started);
CREATE INDEX analytics_sessions_user_seen ON analytics_sessions(user,seen);
CREATE TABLE analytics_events (
 id INTEGER PRIMARY KEY,
 user TEXT REFERENCES auth_accounts(id) ON DELETE CASCADE,
 session TEXT REFERENCES analytics_sessions(id) ON DELETE SET NULL,
 name TEXT NOT NULL,
 created INTEGER NOT NULL
);
CREATE INDEX analytics_events_created ON analytics_events(created,name);
