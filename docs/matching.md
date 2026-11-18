# Match scoring

The displayed percentage is a compatibility score, not a probability. It is the sum of the visible tag contributions, rounded together to two decimal places.

Fixed percentage-point budgets: gender 1, location 10, age 24.92, relationship goal 21.36, interests 17.8, appearance 8.9, sexual preferences 6.23, personality 3.56, habits 3.56, profession 2.67. Missing facts leave their budget unused.

Each category is divided across the searching person's criteria (with explicitly stated importance multipliers). When both people specify desired criteria, half the budget checks each direction. Without explicit preferences, shared self-described facts use the viewer's tag count; additional candidate interests never dilute a match.

Each individual phrase is embedded with its category using text-embedding-3-small (512 dimensions). Vectors are cached in matchlove_tag_vectors by model and normalized phrase. Whole-profile vectors remain only a retrieval priority. Per-tag cosine similarity is mapped to agreement: 0 at or below 0.55, linear growth to 1 at 0.90. These are initial engineering thresholds, not empirically calibrated probabilities. Exact matches retain full agreement. Nonidentical phrases require an explicit semantic confirmation of the same concrete activity/fact (agreement at least 0.8); vector similarity or shared words alone never award points. GPT reviews up to 45 uncached candidate pairs and can reduce embedding agreement for contradictions or ambiguity. If embeddings are unavailable, verified literal semantic evidence is the fallback. Negative and affirmative statements cannot receive points as equivalent. No facts absent from the stored profile can earn points.

Habits are separate from hobbies. Parsing preserves negation and does not infer drinking frequency from liking beer. Existing saved descriptions are reparsed on the next submission if they predate habits extraction.

An explicit desired age range remains a filter. Without a range, known ages differing by up to 5 years receive the age budget; it decreases linearly to zero at 15 years, without excluding the candidate. Missing ages earn no age points. Location uses consented coordinates or an explicitly known city; it is not inferred from IP.
