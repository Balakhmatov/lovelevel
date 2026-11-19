# Match scoring

The displayed percentage is a compatibility score, not a probability. It is the sum of the visible tag contributions, rounded together to two decimal places.

Fixed percentage-point budgets: gender 1, location 10, age 24.92, relationship goal 21.36, interests 17.8, appearance 8.9, sexual preferences 6.23, personality 3.56, habits 3.56, profession 2.67. Missing facts leave their budget unused.

Each category is divided across the searching person's criteria (with explicitly stated importance multipliers). Every score is directional: the full category budget checks only the viewer's wishes against the candidate's facts. Candidate wishes never contribute points or eligibility restrictions to the viewer's score. Without the viewer's explicit preferences, shared self-described facts use the viewer's tag count; additional candidate interests never dilute a match.

Each individual phrase is embedded with its category using text-embedding-3-small (512 dimensions). Vectors are cached in matchlove_tag_vectors by model and normalized phrase. Whole-profile vectors remain only a retrieval priority. Per-tag cosine similarity is mapped to agreement: 0 at or below 0.55, linear growth to 1 at 0.90. These are initial engineering thresholds, not empirically calibrated probabilities. Exact matches and unambiguous canonical habit equivalents (for example «не курю» / «некурящий») retain full agreement. Nonidentical phrases require an explicit semantic confirmation of the same concrete activity/fact (agreement at least 0.8); vector similarity or shared words alone never award points. GPT reviews up to 45 uncached candidate pairs and can reduce embedding agreement for contradictions or ambiguity. If embeddings are unavailable, verified literal semantic evidence is the fallback. Negative and affirmative statements cannot receive points as equivalent. No facts absent from the stored profile can earn points.

Habits are separate from hobbies. Parsing preserves negation and does not infer drinking frequency from liking beer. Existing saved descriptions are reparsed on the next submission if they predate habits extraction.

An explicit desired age range remains a filter. Without a range, known ages differing by up to 5 years receive the age budget; it decreases linearly to zero at 15 years, without excluding the candidate. Missing ages earn no age points. Location uses consented coordinates or an explicitly known city; it is not inferred from IP.

## Editable profiles

`GET /api/ml-profile` returns the signed-in user's editable profile. `?user=ID` returns a visible candidate's self/wanted sections and photo gallery, with no source search text or private edit metadata. Blocked and paused accounts cannot be viewed. Gallery photos are served through `/api/profile-photo?user=ID&id=PHOTO_ID` with the same authorization checks as the main photo, and the photo must belong to the named account.

`PATCH /api/ml-profile` accepts only self/wanted field changes. Each explicitly changed field (including an empty array or string) is protected in `matchlove_profile_overrides`. AI parsing reapplies these overrides before persisting a new profile, so another search cannot restore a deleted hobby or overwrite a corrected fact. An entire manually corrected category is protected; AI updates the remaining categories. AI-generated preference clauses for a protected category are removed to prevent old clauses from influencing scoring. Manual edits invalidate embeddings and pair caches and update autocomplete usage. Profiles display structured fields rather than duplicated biography text. All category arrays use tag editors; an individual phrase, including commas, is serialized as one JSON array item. Long tags remain intact in horizontally scrollable rows.

A profile can be filled in without AI. An empty search input uses the saved structured profile directly; a new text description requires at least 100 characters. AI parses categorized facts on the next text search; the original search text stays on the search page. Both viewing and editing have self/wanted tabs; manual edits survive tab switching and gallery changes before saving.

## Chat presence

The full-screen conversation hides application navigation and keeps the composer inside the visual viewport when the mobile keyboard opens. Chat headers link to the peer profile and show its main photo and transient presence. Polling refreshes chat messages and peer status every 1.5 seconds while the page is visible, without resetting a reader's scroll position.

`POST /api/ml-presence` requires authentication, the same origin, and an opaque per-page client ID. Visible pages renew presence every 15 seconds; hidden/closed pages retire only their own client, preserving other open tabs. A lost client expires after 45 seconds. Typing is accepted only for a mutual, unblocked conversation, expires after 5 seconds without refresh, and is cleared when sending. The UI stops typing after a 2.2 second input pause or on leaving a conversation. `GET /api/ml-chat` returns the authorized peer's name, main photo URL, online boolean and typing boolean. Presence is kept in memory, scoped to the server database instance; it is not persistent activity history.


## Personal percentages and conflicts

Scores and caches are ordered by `(viewer, candidate)`, including when a candidate arrives through an incoming like. The Mark/Alice fixture yields 82.20 for Mark viewing Alice and 73.00 for Alice viewing Mark. The old averaged cache is invalidated by `SCORING_VERSION`.

`conflicts` contains verified candidate facts that contradict the viewer's stated wishes. Smoking and alcohol conflicts use conservative explicit habit states; liking beer alone does not prove alcohol consumption. Semantic conflicts additionally require `conflict=true`, zero agreement, viewer direction, and exact evidence present in both stored profiles. Missing information and unrelated interests do not create conflicts. Conflicts never deduct extra points or automatically exclude people. The existing viewer gender/explicit age filters remain.

The profile's “Кого ищу” tab has an optional habit filter, off by default. `GET/PATCH /api/ml-search-settings` persists `hideHabitConflicts` per account with same-origin checks. Only an explicit opt-in hides candidates with confirmed habit conflicts from search; other categories, unknown habits and existing likes/conversations remain visible. Public profiles expose the viewer's relevant conflicts but never the candidate's private search settings. Search results report `hiddenCount` so an empty filtered list can explain how to restore it.
