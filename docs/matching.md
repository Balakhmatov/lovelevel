# Match scoring

The displayed percentage is a compatibility score, not a probability. It is the sum of the visible tag contributions, rounded together to two decimal places.

Fixed percentage-point budgets: gender 1, location 10, age 24.92, relationship goal 21.36, interests 17.8, appearance 8.9, sexual preferences 6.23, personality 3.56, habits 3.56, profession 2.67. Missing facts leave their budget unused.

Each category is divided across the searching person's criteria (with explicitly stated importance multipliers). When both people specify desired criteria, half the budget checks each direction. Without explicit preferences, shared self-described facts use the viewer's tag count; additional candidate interests never dilute a match.

Each individual phrase is embedded with its category using text-embedding-3-small (512 dimensions). Vectors are cached in matchlove_tag_vectors by model and normalized phrase. Whole-profile vectors remain only a retrieval priority. Per-tag cosine similarity is mapped to agreement: 0 at or below 0.55, linear growth to 1 at 0.90. These are initial engineering thresholds, not empirically calibrated probabilities. Exact matches retain full agreement. Nonidentical phrases require an explicit semantic confirmation of the same concrete activity/fact (agreement at least 0.8); vector similarity or shared words alone never award points. GPT reviews up to 45 uncached candidate pairs and can reduce embedding agreement for contradictions or ambiguity. If embeddings are unavailable, verified literal semantic evidence is the fallback. Negative and affirmative statements cannot receive points as equivalent. No facts absent from the stored profile can earn points.

Habits are separate from hobbies. Parsing preserves negation and does not infer drinking frequency from liking beer. Existing saved descriptions are reparsed on the next submission if they predate habits extraction.

An explicit desired age range remains a filter. Without a range, known ages differing by up to 5 years receive the age budget; it decreases linearly to zero at 15 years, without excluding the candidate. Missing ages earn no age points. Location uses consented coordinates or an explicitly known city; it is not inferred from IP.

## Editable profiles

`GET /api/ml-profile` returns the signed-in user's editable profile. `?user=ID` returns a visible candidate's self/wanted sections and photo gallery, with no source search text or private edit metadata. Blocked and paused accounts cannot be viewed. Gallery photos are served through `/api/profile-photo?user=ID&id=PHOTO_ID` with the same authorization checks as the main photo, and the photo must belong to the named account.

`PATCH /api/ml-profile` accepts only self/wanted field changes. Each explicitly changed field (including an empty array or string) is protected in `matchlove_profile_overrides`. AI parsing reapplies these overrides before persisting a new profile, so another search cannot restore a deleted hobby or overwrite a corrected fact. An entire manually corrected category is protected; AI updates the remaining categories. AI-generated preference clauses for a protected category are removed to prevent old clauses from influencing scoring. Manual edits invalidate embeddings and pair caches and update autocomplete usage. Profile biography text is editable display copy; matching uses the structured fields shown below it.

A profile can be filled in without AI. An empty search input uses the saved structured profile directly; a new text description requires at least 100 characters. AI parses two short bios as well as categorized facts on the next text search. Both viewing and editing have self/wanted tabs; manual edits survive tab switching and gallery changes before saving.
