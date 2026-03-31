#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
FRONTEND_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${CLOUD_RUN_SERVICE:=duduk-web-staging}"

CLOUD_RUN_MEMORY=${CLOUD_RUN_MEMORY:-512Mi}
CLOUD_RUN_CPU=${CLOUD_RUN_CPU:-1}
CLOUD_RUN_TIMEOUT=${CLOUD_RUN_TIMEOUT:-120}
CLOUD_RUN_MIN_INSTANCES=${CLOUD_RUN_MIN_INSTANCES:-0}
CLOUD_RUN_MAX_INSTANCES=${CLOUD_RUN_MAX_INSTANCES:-3}
SKIP_FRONTEND_BUILD=${SKIP_FRONTEND_BUILD:-0}

if [ "$SKIP_FRONTEND_BUILD" != "1" ]; then
  echo "Building frontend static export into $FRONTEND_DIR/out ..."
  cd "$FRONTEND_DIR"
  npm run build:mobile
fi

if [ ! -d "$FRONTEND_DIR/out" ]; then
  echo "Missing frontend/out. Build the static export before deploy." >&2
  exit 1
fi

gcloud run deploy "$CLOUD_RUN_SERVICE" \
  --project "$GCP_PROJECT_ID" \
  --region "$GCP_REGION" \
  --platform managed \
  --source "$FRONTEND_DIR" \
  --allow-unauthenticated \
  --port 8080 \
  --memory "$CLOUD_RUN_MEMORY" \
  --cpu "$CLOUD_RUN_CPU" \
  --timeout "$CLOUD_RUN_TIMEOUT" \
  --min-instances "$CLOUD_RUN_MIN_INSTANCES" \
  --max-instances "$CLOUD_RUN_MAX_INSTANCES"

PROJECT_NUMBER=$(
  gcloud projects describe "$GCP_PROJECT_ID" \
    --format='value(projectNumber)'
)

LEGACY_SERVICE_URL=$(
  gcloud run services describe "$CLOUD_RUN_SERVICE" \
    --project "$GCP_PROJECT_ID" \
    --region "$GCP_REGION" \
    --format='value(status.url)'
)

SERVICE_URL="https://${CLOUD_RUN_SERVICE}-${PROJECT_NUMBER}.${GCP_REGION}.run.app"

echo ""
echo "Frontend Cloud Run service deployed."
echo "Service URL: $SERVICE_URL"
echo "Health check: ${SERVICE_URL}/healthz/"
echo "Legacy URL: $LEGACY_SERVICE_URL"
