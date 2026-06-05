# Timeline Voice Notifier

Timeline-based voice notification app with a React frontend and a server deployment path based on MongoDB and containers.

## Stack

- React
- TypeScript
- Vite
- Node.js + Express
- MongoDB
- Luxon

## Features

- Create scenarios with multiple timeline events
- Select timezone, defaulting to `Asia/Ho_Chi_Minh`
- Add event title and optional description
- Use built-in alert sounds or upload audio files stored on the server
- Run a saved scenario with current event highlight, next event countdown, support text, and audio playback
- Optional S3 mirroring for uploaded audio with local disk cache fallback

## Run locally

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/media` to `http://localhost:3001`.

## Run backend locally

```bash
cd server
npm install
npm start
```

The backend expects MongoDB at `mongodb://127.0.0.1:27017/timeline_notifier` by default.

Optional backend env for audio storage:

- `AUDIO_S3_ENABLED=true` enables S3 mirroring and cache hydration for uploaded audio
- `AUDIO_S3_BUCKET=my-audio-bucket` selects the target bucket
- `AUDIO_S3_PREFIX=timeline-notifier/audio` stores objects under that path prefix inside the bucket
- AWS credentials and region are loaded by the AWS SDK from the standard environment, for example `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`

When S3 is enabled:

- uploads still land in `MEDIA_DIR` first
- the backend uploads the same file to S3
- audio is still served from `/media/*`
- if a local file is missing, the backend fetches it from S3, writes it back into `MEDIA_DIR`, and then serves it

## Build

```bash
npm run build
```

## Run with containers

```bash
docker compose up --build
```

Endpoints:

- App: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`

Container layout:

- `frontend`: nginx serving the built Vite app
- `backend`: Express API for scenarios and audio uploads
- `mongo`: MongoDB for scenario metadata
- `media-data` volume: uploaded media files mounted into the backend container

## Run as a single app container

If you want to avoid running separate frontend and backend containers, use the single-container setup below. It still keeps MongoDB separate, which is the safer and more maintainable deployment shape.

```bash
docker compose -f docker-compose.single.yml up --build
```

In this mode:

- one `app` container serves both the built frontend and the backend API
- `mongo` stays in its own container
- uploaded media is persisted in the `media-data` Docker volume

App URL:

- `http://localhost:8080`

## Notes

- Uploaded audio files are served from `/media/*` through the backend.
- With `AUDIO_S3_ENABLED=true`, `/media/*` uses local disk as a cache and only reaches out to S3 when the file is missing locally.
- The browser still needs a user gesture before audio playback is fully unlocked.
- Live notifications still depend on the run screen being open in the browser.
