# Levels and media — 30 October 2026

Levels are ordered milestones; the old point ledger is retained only to preserve
legacy account status. Existing earned levels never decrease on upgrade.

| Level | Condition |
| --- | --- |
| 1 | Register |
| 2 | Save basic profile and intent |
| 3 | Biography of at least 60 trimmed characters and at least 3 interests |
| 4 | Upload 3 photos |
| 5 | Send 1 real like; mutual interest is unnecessary |
| 6 | Open the app on 2 distinct Moscow calendar dates |
| 7 | Save the access setting on a non-main photo |
| 8 | Open the app on 4 distinct Moscow calendar dates |
| 9 | Upload a video of up to 30 seconds |
| 10 | Upload a voice recording of up to 30 seconds |

Tools are available immediately, future actions count in advance, and users
claim each next level in order. Visit dates are recorded by authenticated /me
requests, once per Moscow date. Historical daily-claim dates and profile creation
dates are backfilled. Visits need not be consecutive. Client-supplied dates,
points and clip durations cannot satisfy conditions.

Media awaiting moderation counts towards upload conditions; rejected media does
not. Earned levels persist after deletion of material. Moderation is separate.
All profiles remain visible. Levels 1–3 see the main photo and a stable selection
of up to 2 ordinary photos; level 4+ sees the ordinary gallery. Higher photo
thresholds and all video/audio thresholds are set by the author. Uploading any
format is available at any level. The test remains free and prohibits explicit
sexual material; intimate access is not implied by reaching levels 9–10.

Free limits: 12 photos, 2 videos, 2 voice recordings. Photos: 5 MiB.
Clip source upload: 50 MiB, discarded after processing. Video output: H.264/AAC,
24fps, up to 720p (portrait 720x1280), 3 MiB. Voice output: mono AAC 24kHz/32kbps,
192 KiB maximum. Only the compressed output is stored. Videos:
MP4/MOV/WebM up to 30 seconds. Audio: WebM, Ogg, MP4/M4A, WAV or MP3 up to 30 seconds.
The microphone recorder negotiates an available browser format; ready-made audio
upload remains available if microphone permission or MediaRecorder is unavailable.
Files remain private until moderated; protected playback also works via short-lived
in-memory blob URLs when Telegram blocks cookies. Blobs are revoked on removal.

## VPS dependency

The Node adapter validates clip format/streams/duration using local ffprobe with
file-only protocols, a format allowlist and an 8-second timeout. It then uses
ffmpeg with 2 codec threads and a 60-second timeout to normalize and compress
clips. One upload is admitted at a time, before buffering the source; excess
requests receive 429. Private temporary sources and outputs are removed in finally.
The media folder has an 8 GiB quota; writes preserve at least 1 GiB of free disk.
Usage includes pre-existing files and is checked atomically for parallel writes.
An absent processor returns a clear 503 for clips; the rest of the app keeps
working. After auto-deploy, run once as root:

```sh
bash /opt/lovelevel/current/deploy/enable-media.sh
```

This installs the Ubuntu ffmpeg package only if ffprobe is absent, verifies the
runtime user can execute it, and restarts only LoveLevel. For 50 MiB sources, apply only the LoveLevel vhost update after auto-deploy:

```sh
bash /opt/lovelevel/current/deploy/configure-nginx.sh --https
```

The vhost allows 52 MiB requests and a 90-second response timeout, with request
buffering disabled so source uploads are not duplicated into Nginx temp files. Other apps
are unchanged.

Migration 0003 adds milestone state, distinct visit dates and clip metadata, with
legacy status preservation. The existing deployment backup/rollback covers all
SQLite tables. Codec HTTP tests skip explicitly if ffprobe is absent during a
build; rerun them after enabling the processor. Local verification includes real
video upload, synthetic microphone recording via browser MediaRecorder, two-user
chat and milestone claims 1–10. Day changes in QA are simulated via fixture rows,
never a production bypass. Telegram SDK transport is mocked only in browser QA.
