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
5. In your own MatchLove account, open Profile → Email notifications, enable the desired types and save. Trigger a new like or message from another account. Check delivery in Resend. Use real addresses you control.

The worker checks a durable SQLite outbox every 15 seconds. Each recipient receives at most one newly queued notice per type per ten minutes. Identical likes do not create notices again. Messages contain a generic event and a link to MatchLove, never the message body, profile details or the sender's name. Users can turn off either notification type in Profile. Disabled preferences are checked again before delivery. Failed attempts retry up to three times with increasing delay; outbox rows are removed after seven days. Provider idempotency keys prevent duplicates on retries. Delivery failure does not fail the like/message request.

To stop delivery, remove the Resend key from the environment and restart. Users' stored preferences remain. Removing the account cascades to its preferences and queued notices. Provider delivery or suppression policies can still affect delivery. No actual sending is claimed by the automated tests: they use a mock provider.
