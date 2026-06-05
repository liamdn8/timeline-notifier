#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export PORT="${PORT:-3001}"
# export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/timeline_notifier}"
export MEDIA_DIR="${MEDIA_DIR:-$ROOT_DIR/server/media}"
# export AUDIO_S3_ENABLED="${AUDIO_S3_ENABLED:-false}"
# export AUDIO_S3_BUCKET="${AUDIO_S3_BUCKET:-}"
# export AUDIO_S3_PREFIX="${AUDIO_S3_PREFIX:-}"

export AUDIO_S3_ENABLED=true
export AUDIO_S3_BUCKET=kvalidator-2026
export AUDIO_S3_PREFIX=timeline-notifier/audio

# AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
# are intentionally not set here so the AWS SDK can load them from the env.

cd "$ROOT_DIR/server"
exec npm start
