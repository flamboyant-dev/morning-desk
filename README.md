# Morning desk

A private admin site that records an m3u8 stream every morning from **7:10 to 7:25 IST**, keeps the video in Google Drive, sends the audio (and a Drive link) to Telegram, and lets you play both back in the browser.

Your computer does not stay on. A free GitHub Actions runner is the clock. The site itself can live on Vercel’s free plan. Drive’s free 15 GB holds the files, and clips older than 60 days are deleted so that space lasts.

Only record a stream you are allowed to keep.

## Run it here

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). Until you set `ADMIN_PASSWORD`, the local password is `morning`.

With no Google or Telegram keys, settings and recordings sit in `data/` (that folder is not committed). The archive shows a six-second sample until a real take exists. Put a stream URL in Settings, then **Record 30 seconds**. On this machine that records locally. On the hosted site it starts the GitHub Action.

Record from the terminal:

```bash
npm run record -- --seconds 30 --url "https://example.com/live/index.m3u8" --now
```

A direct `.m3u8` is used as-is. A normal page URL is fetched and the playlist inside it is picked up at start time, so a short-lived player link is still fresh at 7:10.

## What you connect once

All four accounts are free. The morning job will not run until the GitHub secrets exist, because this project cannot stay awake at 7:10 by itself.

### 1. Telegram

1. Message [@BotFather](https://t.me/BotFather) and create a bot.
2. Copy the token into `TELEGRAM_BOT_TOKEN`.
3. Send any message to your bot.
4. Open `https://api.telegram.org/bot<token>/getUpdates` and copy the chat id into `TELEGRAM_CHAT_ID`.

Telegram bots can upload about 50 MB. Fifteen minutes of audio fits. Fifteen minutes of video does not, so Telegram gets the MP3 plus a link to the video.

### 2. Google Drive

A service account cannot store files in a normal Gmail folder (it has no quota). Use your own Google login so the files count against your 15 GB.

1. In [Google Cloud](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. Configure the OAuth consent screen as **External**, add yourself as a test user, and add the scope `https://www.googleapis.com/auth/drive`.
3. Create an OAuth client of type **Desktop app**.
4. In Drive, create a folder. The id is the last part of `https://drive.google.com/drive/folders/FOLDER_ID`.
5. On any computer, from this project:

```bash
GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." npm run drive-auth
```

6. Open the printed link, approve access, and copy `GOOGLE_REFRESH_TOKEN`.

Playback uses an unlisted Drive link (anyone with the link can open that file). The desk itself stays behind the password. A 15-minute 720p file is about 100 MB, so 60 days is roughly 6 GB.

### 3. GitHub Actions

Push this project to GitHub. Under **Settings → Secrets and variables → Actions**, add:

- `GOOGLE_CLIENT_ID` — OAuth client id
- `GOOGLE_CLIENT_SECRET` — OAuth client secret
- `GOOGLE_REFRESH_TOKEN` — from `npm run drive-auth`
- `DRIVE_FOLDER_ID` — the folder id
- `TELEGRAM_BOT_TOKEN` — from BotFather
- `TELEGRAM_CHAT_ID` — your chat id

The workflow [`.github/workflows/record.yml`](.github/workflows/record.yml) starts at 01:35 UTC (07:05 IST), waits until 07:10, then records 15 minutes. GitHub’s free scheduler can slip by a few minutes. The desk shows the real start time. You can also run it by hand from the Actions tab; the manual run records 30 seconds unless you change the input.

Use a public repository if you want unlimited Actions minutes. A private free repo includes 2,000 minutes a month, and this job uses about 20 a day.

### 4. The website on Vercel

Import the repo at [vercel.com](https://vercel.com). Set the same Drive and Telegram variables, plus:

- `ADMIN_PASSWORD` — a real password
- `GITHUB_DISPATCH_TOKEN` — a fine-grained personal access token for this repo with **Actions: Read and write**
- `GITHUB_REPOSITORY` — `owner/name`
- `GITHUB_DISPATCH_REF` — `main`

**Record now** on the hosted site starts that workflow. It does not record inside Vercel, because a free function cannot stay open for 15 minutes.

Copy `.env.example` to `.env.local` for any of these values when you run the app yourself.

## Schedule

7:10 IST is 01:40 UTC. India does not use daylight saving. The recorded file is a 720p MP4 and a 128 kbps MP3.
