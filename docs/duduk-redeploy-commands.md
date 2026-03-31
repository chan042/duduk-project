# Duduk 재배포 명령 정리

이 문서는 `duduk` 프로젝트에서 자주 쓰는 재배포 명령을 빠르게 복붙할 수 있도록 정리한 문서입니다.

현재 스테이징 환경:

- 프론트 웹: [https://duduk-web-staging-128789205583.asia-northeast3.run.app](https://duduk-web-staging-128789205583.asia-northeast3.run.app)
- 백엔드 API: [https://duduk-api-staging-128789205583.asia-northeast3.run.app](https://duduk-api-staging-128789205583.asia-northeast3.run.app)
- GCP 프로젝트: `duduk-300c`
- 리전: `asia-northeast3`

## 1. 프론트 웹 스테이징 재배포

언제 쓰나:

- `frontend/.env.production` 값 변경
- 화면, 스타일, 프론트 로직 변경
- Google OAuth Client ID 변경
- Kakao JS Key 변경

### 1-1. 프론트 Cloud Run 재배포

`frontend/cloudrun/deploy.sh`는 배포 전에 `npm run build:mobile`을 먼저 실행해서 `frontend/out`을 항상 새로 만듭니다.
이 단계가 빠지면 Cloud Run에는 이전 정적 번들이 그대로 올라갈 수 있습니다.

```bash
cd /Users/chan/Project/duduk-project
CLOUDSDK_CORE_DISABLE_PROMPTS=1 \
GCP_PROJECT_ID=duduk-300c \
GCP_REGION=asia-northeast3 \
CLOUD_RUN_SERVICE=duduk-web-staging \
sh /Users/chan/Project/duduk-project/frontend/cloudrun/deploy.sh
```

이미 최신 `frontend/out`이 있고 빌드를 건너뛰고 싶으면:

```bash
cd /Users/chan/Project/duduk-project
SKIP_FRONTEND_BUILD=1 \
CLOUDSDK_CORE_DISABLE_PROMPTS=1 \
GCP_PROJECT_ID=duduk-300c \
GCP_REGION=asia-northeast3 \
CLOUD_RUN_SERVICE=duduk-web-staging \
sh /Users/chan/Project/duduk-project/frontend/cloudrun/deploy.sh
```

### 1-2. 배포 후 확인

- 메인 페이지: [https://duduk-web-staging-128789205583.asia-northeast3.run.app](https://duduk-web-staging-128789205583.asia-northeast3.run.app)
- 로그인 페이지: [https://duduk-web-staging-128789205583.asia-northeast3.run.app/login](https://duduk-web-staging-128789205583.asia-northeast3.run.app/login)

## 2. 백엔드 API 스테이징 재배포

언제 쓰나:

- Django 코드 변경
- API 응답, 비즈니스 로직 변경
- `CORS`, `CSRF`, `ALLOWED_HOSTS` 변경
- Cloud Run 환경변수 변경

### 2-1. 백엔드 Cloud Run 재배포

```bash
cd /Users/chan/Project/duduk-project
CLOUDSDK_CORE_DISABLE_PROMPTS=1 \
GCP_PROJECT_ID=duduk-300c \
GCP_REGION=asia-northeast3 \
CLOUD_RUN_SERVICE=duduk-api-staging \
CLOUD_SQL_INSTANCE=duduk-300c:asia-northeast3:duduk-staging-db \
ENV_VARS_FILE=/Users/chan/Project/duduk-project/backend/cloudrun/env.staging.yaml \
sh /Users/chan/Project/duduk-project/backend/cloudrun/deploy.sh
```

기본적으로 이 명령은 배포가 끝난 뒤 참조 데이터 시드 Job도 자동 실행합니다.
자동 실행되는 관리 명령:

```bash
python manage.py seed_reference_data --force-update
```

### 2-2. 배포 후 확인

- 헬스체크: [https://duduk-api-staging-128789205583.asia-northeast3.run.app/healthz/](https://duduk-api-staging-128789205583.asia-northeast3.run.app/healthz/)

### 2-3. 참조 데이터 시드 실행

새 Cloud SQL이거나 참조 데이터 갱신이 필요한 경우:

```bash
cd /Users/chan/Project/duduk-project
GCP_PROJECT_ID=duduk-300c \
GCP_REGION=asia-northeast3 \
CLOUD_SQL_INSTANCE=duduk-300c:asia-northeast3:duduk-staging-db \
ENV_VARS_FILE=/Users/chan/Project/duduk-project/backend/cloudrun/env.staging.yaml \
sh /Users/chan/Project/duduk-project/backend/cloudrun/seed_reference_data.sh
```

실행되는 관리 명령:

```bash
python manage.py seed_reference_data --force-update
```

자동 실행을 잠시 끄고 싶으면:

```bash
cd /Users/chan/Project/duduk-project
RUN_REFERENCE_SEED=0 \
GCP_PROJECT_ID=duduk-300c \
GCP_REGION=asia-northeast3 \
CLOUD_RUN_SERVICE=duduk-api-staging \
CLOUD_SQL_INSTANCE=duduk-300c:asia-northeast3:duduk-staging-db \
ENV_VARS_FILE=/Users/chan/Project/duduk-project/backend/cloudrun/env.staging.yaml \
sh /Users/chan/Project/duduk-project/backend/cloudrun/deploy.sh
```

## 3. 모바일 앱에 프론트 변경 반영

언제 쓰나:

- 프론트 변경사항을 Capacitor iOS 앱과 Android 앱에도 반영하고 싶을 때

### 3-1. 모바일용 정적 빌드 생성 + Capacitor 동기화

```bash
cd /Users/chan/Project/duduk-project/frontend
npm run build:mobile
npx cap sync
```

### 3-2. 네이티브 프로젝트 열기

#### iOS

```bash
cd /Users/chan/Project/duduk-project/frontend
npx cap open ios
```

#### Android

```bash
cd /Users/chan/Project/duduk-project/frontend
npx cap open android
```

## 4. 작업 종류별로 어떤 명령을 쓰는지

### 화면이나 프론트 로직만 바뀐 경우

1. `frontend/.env.production` 또는 프론트 코드 수정
2. 프론트 Cloud Run 재배포
3. 필요하면 `npx cap sync`

### 백엔드 API만 바뀐 경우

1. Django 코드 또는 `backend/cloudrun/env.staging.yaml` 수정
2. 백엔드 Cloud Run 재배포
3. 필요하면 `RUN_REFERENCE_SEED=0` 으로 자동 시드를 끄거나, 수동으로 `seed_reference_data.sh` 재실행

### 프론트 변경을 앱에도 반영해야 하는 경우

1. `npm run build:mobile`
2. `npx cap sync`
3. `npx cap open ios` 또는 `npx cap open android`

## 5. 한 줄 요약

- 웹사이트 다시 올리기: `frontend/cloudrun/deploy.sh`
- API 서버 다시 올리기: `backend/cloudrun/deploy.sh`
- 앱 껍데기에 프론트 다시 반영하기: `npm run build:mobile && npx cap sync`
