# Email notifications for MatchLove

Delivery is optional and disabled until both variables below are configured. User preferences default to off. Supported provider: Resend (HTTPS API; no SMTP library). Never put API keys in git or browser code.

1. Create a Resend account and add an owned sender domain, for example `cityai.site`. Add the DNS records Resend provides in Cloudflare. Use the exact record names and values supplied by Resend; do not replace existing MX/SPF records blindly. Wait until the domain is verified.
2. Create a sending API key restricted to the verified domain where supported.
3. On the VPS, edit `/etc/lovelevel/app.env` using `sudoedit` and add:

   ```dotenv
   RESEND_API_KEY=<server-side sending API key>
   MATCHLOVE_MAIL_FROM=MatchLove <notifications@cityai.site>
   ```

4. Restart the service: `sudo systemctl restart lovelevel`. Check `sudo systemctl status lovelevel --no-pager`. Do not paste the environment file or key into chat.
5. In your own MatchLove account, open Profile → Email notifications, enable the desired types and save. Trigger a new like, mutual match or message from another account. The first summary becomes due 24 hours after the first enabled event. Check delivery in Resend. Use real addresses you control.

The worker checks durable SQLite state every 15 seconds. It collects individual likes, mutual matches and messages, then sends one combined summary per recipient at most once every 24 hours. The first complete window starts at the first enabled event. Quiet windows produce no mail. The likes preference also controls mutual matches. A repeated like never increments the counts. Only incoming events and new matches are counted, not the recipient's outgoing messages.

The mail shows counts, its 24-hour period in Moscow time, and an “Open MatchLove” HTML button with a plain-text fallback. It contains no message bodies, profile details or other users' names. Blocked peers are excluded when the summary is built. Preferences and destination email are checked again before delivery; a pending snapshot is cancelled if they changed.

Each summary is saved as an immutable payload with one provider idempotency key. Retries cannot change its counts or body; events arriving while it is being retried belong to the next window. Failed attempts retry up to three times with increasing delay. Pending snapshots expire after 24 hours to stay within provider idempotency retention. The next new summary is delayed until at least 24 hours after the previous delivery attempt, including ambiguous failures. Sent history and raw events are retained for seven days. State survives restarts. After an outage longer than a day, stale windows are skipped: at most one latest-day summary is built, never a backlog of daily emails.

Migration 0018 removes unsent legacy instant notices so they cannot be delivered after upgrading. Sent history is retained. Event counts start accumulating after the update. Delivery failure never fails the like/message request.

To stop delivery, remove the Resend key from the environment and restart. Users' stored preferences remain. Removing the account cascades to its preferences and queued notices. Provider delivery or suppression policies can still affect delivery. No actual sending is claimed by the automated tests: they use a mock provider.
