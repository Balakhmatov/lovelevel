# Chat recordings

Mutual likes are required for sending and reading. Blocks revoke further API access. Private files are served only through authenticated endpoints (cookie or Mini App bearer), never public upload URLs. Already downloaded bytes cannot be revoked. No autoplay with sound and no end-to-end encryption.

- Voice: free, 30 seconds, mono AAC 24kHz/32kbps, max 192 KiB.
- Circle: active Plus required only for sender, 10 seconds, center-cropped H264 MP4 480×480/24fps, mono AAC, max 1 MiB. Receiver plays without Plus. 20 videos per rolling 24 hours; general chat rate 20 messages/minute.
- Source up to 50 MiB; duration/format verified, normalized server-side. Sources and transcoding temporary files removed. Existing 8 GiB media quota, 1 GiB disk reserve and global single upload/transcode slot also apply to chat.
- Preview before sending, stop/discard, ready-file fallback. Recorder stops on hide and releases devices on close/navigation. Unsupported browser/permission refusal uses file fallback.
- Receive-video setting is account-wide, editable inside chat and persisted. It affects new sends, not previously received messages.
- Profile video/audio milestones remain profile publications; chat messages do not complete them.
- Report controls are attached to each incoming message. Moderators can play only the reported attachment through report context, with audit log. Account deletion removes both sides of the associated conversation and private media files.

## Test Plus without billing

No checkout is shipped, no subscriptions are charged. Plus is an expiring server entitlement. Existing customers are not silently upgraded. An operator can grant/revoke for testing on the VPS:

```sh
cd /opt/lovelevel/current
runuser -u lovelevel -- /usr/local/bin/node-lovelevel --experimental-sqlite server/manage.mjs grant-plus --id USER_ID --days 30
# revoke-plus --id USER_ID
```

Then reload the app; no service restart required. `list-accounts` shows IDs. Paid Telegram purchases need a separate Stars billing implementation with verified, idempotent payment processing.

## Verification

`tests/chat-media.test.mjs`: real HTTP, compression, entitlement expiry and quota, opt-out, report access, block, cookie-less bearer, deletion cleanup. `scripts/chat-media-browser-qa.mjs`: two users with fake devices, real MediaRecorder and playback, auto-stop video, polling stability, opt-out and free gate. Run after `npm run build` with Node 22 + ffmpeg/ffprobe.
