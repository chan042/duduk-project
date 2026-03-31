#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
BACKEND_DIR=$(CDPATH= cd -- "$REPO_ROOT/backend" && pwd)

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${CLOUD_RUN_SERVICE:=duduk-api-staging}"
: "${CLOUD_SQL_INSTANCE:?Set CLOUD_SQL_INSTANCE}"

ENV_VARS_FILE=${ENV_VARS_FILE:-"$SCRIPT_DIR/env.staging.yaml"}
CLOUD_RUN_MEMORY=${CLOUD_RUN_MEMORY:-1Gi}
CLOUD_RUN_CPU=${CLOUD_RUN_CPU:-1}
CLOUD_RUN_TIMEOUT=${CLOUD_RUN_TIMEOUT:-300}
CLOUD_RUN_MIN_INSTANCES=${CLOUD_RUN_MIN_INSTANCES:-0}
CLOUD_RUN_MAX_INSTANCES=${CLOUD_RUN_MAX_INSTANCES:-3}
RUN_REFERENCE_SEED=${RUN_REFERENCE_SEED:-1}
SEED_REFERENCE_FORCE_UPDATE=${SEED_REFERENCE_FORCE_UPDATE:-1}
SEED_REFERENCE_PRUNE_SHOP=${SEED_REFERENCE_PRUNE_SHOP:-0}
CLOUD_RUN_SEED_JOB=${CLOUD_RUN_SEED_JOB:-"${CLOUD_RUN_SERVICE}-seed"}

if [ ! -f "$ENV_VARS_FILE" ]; then
  echo "Missing env vars file: $ENV_VARS_FILE" >&2
  echo "Copy backend/cloudrun/env.staging.example.yaml to backend/cloudrun/env.staging.yaml and fill it in first." >&2
  exit 1
fi

gcloud run deploy "$CLOUD_RUN_SERVICE" \
  --project "$GCP_PROJECT_ID" \
  --region "$GCP_REGION" \
  --platform managed \
  --source "$BACKEND_DIR" \
  --allow-unauthenticated \
  --port 8080 \
  --memory "$CLOUD_RUN_MEMORY" \
  --cpu "$CLOUD_RUN_CPU" \
  --timeout "$CLOUD_RUN_TIMEOUT" \
  --min-instances "$CLOUD_RUN_MIN_INSTANCES" \
  --max-instances "$CLOUD_RUN_MAX_INSTANCES" \
  --add-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
  --env-vars-file "$ENV_VARS_FILE"

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

SERVICE_IMAGE=$(
  gcloud run services describe "$CLOUD_RUN_SERVICE" \
    --project "$GCP_PROJECT_ID" \
    --region "$GCP_REGION" \
    --format='value(spec.template.spec.containers[0].image)'
)

SERVICE_ACCOUNT=$(
  gcloud run services describe "$CLOUD_RUN_SERVICE" \
    --project "$GCP_PROJECT_ID" \
    --region "$GCP_REGION" \
    --format='value(spec.template.spec.serviceAccountName)'
)

if [ "$RUN_REFERENCE_SEED" = "1" ]; then
  SEED_REFERENCE_ARGS="manage.py,seed_reference_data"
  if [ "$SEED_REFERENCE_FORCE_UPDATE" = "1" ]; then
    SEED_REFERENCE_ARGS="${SEED_REFERENCE_ARGS},--force-update"
  fi
  if [ "$SEED_REFERENCE_PRUNE_SHOP" = "1" ]; then
    SEED_REFERENCE_ARGS="${SEED_REFERENCE_ARGS},--prune-shop"
  fi

  CLOUD_RUN_JOB="$CLOUD_RUN_SEED_JOB" \
  CLOUD_RUN_IMAGE="$SERVICE_IMAGE" \
  CLOUD_RUN_SERVICE_ACCOUNT="$SERVICE_ACCOUNT" \
  SEED_REFERENCE_ARGS="$SEED_REFERENCE_ARGS" \
  sh "$SCRIPT_DIR/seed_reference_data.sh"
fi

echo ""
echo "Cloud Run service deployed."
echo "Service URL: $SERVICE_URL"
echo "Health check: ${SERVICE_URL}/healthz/"
echo "Legacy URL: $LEGACY_SERVICE_URL"
if [ "$RUN_REFERENCE_SEED" = "1" ]; then
  echo "Reference data seed job: ${CLOUD_RUN_SEED_JOB}"
fi
