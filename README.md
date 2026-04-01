# Duduk (두둑) - 초개인화 AI 소비 코칭 서비스

<div align="center">

<img src="frontend/public/images/characters/char_cat/face_happy.png" width="120" alt="Duduk Logo">

<h3>"두둑이와 함께하는 즐거운 절약 습관"</h3>

<p>
두둑은 <b>AI 소비 코칭</b>과 <b>게이미피케이션</b>을 결합하여<br>
사용자가 즐겁게 절약하고 자산을 관리할 수 있도록 돕는 핀테크 서비스입니다.
</p>

<img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white"/>
<img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black"/>
<img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/>
<br>
<img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white"/>
<img src="https://img.shields.io/badge/DRF-A30000?style=for-the-badge&logo=django&logoColor=white"/>
<img src="https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white"/>
<br>
<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"/>

</div>

<br>

## 🌟 주요 기능

### 1. 🤖 개인화 AI 소비 코칭
**Duduk AI**가 사용자의 소비 패턴을 실시간으로 분석합니다.
* **초개인화 소비 코칭 카드**
  - Duduk AI가 사용자의 소비 패턴을 학습하여 **키워드 기반 대안, 행동 변화 제안, 위치 기반 대안, 누수 소비** 항목으로 구분 후, 지속적으로 코칭 카드를 제공합니다.
* **월간 AI 소비 분석 리포트**
  - 매월 1 일, 지난달의 소비 데이터를 종합적으로 심층 분석하여 이번달 소비 전략을 수립할 수 있는 심층 분석 리포트를 제공합니다. 분석 리포트에는 **소비 성향 분석, 코칭 성과 가시화, 개선도 추적 비교, 윤택 지수**가 포함되어 있습니다.

### 2. 💵 멀티모달(Multi-modal) 지출 입력 시스템 'Quick Add'
기존 가계부의 번거로운 입력 방식을 개선하기 위해 다양한 차세대 입력 방식을 지원합니다.

* **자연어 입력**
  - "강남 스타벅스 아메리카노 4500 원"과 같이 일상 언어로 입력하면, AI가 자동으로 카테고리, 금액 등을 파싱 후 저장.

* **영수증 OCR 스캔**
  - 종이 영수증을 촬영하면 광학 문자 인식(OCR) 기술을 통해 상호명, 일시, 품목별 금액 합계를 자동으로 디지털화.

* **이미지-상품 매칭**
  - 사용자가 음식점 사진을 업로드하면 AI가 이미지를 분석 후 해당 가게의 메뉴 가격 정보를 검색하고 사용자가 소비한 메뉴와 매칭.

### 3. 🐾 인터랙티브 캐릭터 '두둑이'
사용자의 소비 상태에 따라 감정이 변하는 펫 시스템으로 절약 동기를 부여합니다.
| 🐱 고양이  | 🐶 강아지  | 🐹 햄스터  | 🐑 양  |
| :---: | :---: | :---: | :---: |
| <img src="frontend/public/images/characters/char_cat/face_happy.png" width="80"> | <img src="frontend/public/images/characters/char_dog/face_happy.png" width="80"> | <img src="frontend/public/images/characters/char_ham/face_happy.png" width="80"> | <img src="frontend/public/images/characters/char_sheep/face_happy.png" width="80"> |

> *두둑이는 사용자가 과소비하면 우울해하고, 절약에 성공하면 행복해합니다.*

### 4. 🏆 게이미피케이션
지루한 절약은 그만, 이제 즐기세요!
* **다양한 챌린지**: 두둑 챌린지, AI 추천 챌린지, 사용자 커스텀 챌린지를 제공합니다.
* **보상 시스템**: 챌린지 성공 시 포인트를 지급받아 두둑이를 꾸며줄 아이템을 구입할 수 있습니다.

### 5. 📅 스마트 가계부 & 예산 관리
* **자동 예산 계산**: 월별 목표 예산을 설정하면 '오늘 쓸 수 있는 돈'을 실시간으로 알려줍니다.
* **무지출 도장**: 지출이 없는 날은 캘린더에 스탬프를 찍어 시각적인 성취감을 제공합니다.
* **고정 지출 분리**: 월세, 구독료 등 고정비를 제외한 실제 가용 자금을 관리합니다.

<br>

## 🛠 기술 스택 (Tech Stack)

| 구분 | 기술 | 설명 |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 16 (App Router)** | 서버 사이드 렌더링(SSR) 및 최신 라우팅 최적화 |
| | **React 19** | 최신 훅과 컴포넌트 라이프사이클 관리 |
| | **Tailwind CSS** | 유틸리티 퍼스트 CSS 프레임워크로 빠른 UI 개발 |
| **Backend** | **Django 5.2** | 강력하고 안전한 Python 웹 프레임워크 |
| | **Django REST Framework** | RESTful API 설계 및 구현 |
| | **Simple JWT** | 안전한 사용자 인증 처리 |
| **AI / Data** | **Google Gemini API** | Gemini 모델을 이용한 자연어 처리, 비전 분석, 웹 검색 기반 코칭 생성 |
| **Infrastructure** | **Docker & Compose** | 컨테이너 기반의 개발 및 배포 환경 구축 |
| | **PostgreSQL 15** | 관계형 데이터베이스 |

<br>

## 🚀 사용해보기

이 프로젝트는 Docker Compose를 통해 손쉽게 실행할 수 있습니다.

### 1. 저장소 복제 (Clone)
```bash
git clone [https://github.com/lyuchanchan/duduk-project.git](https://github.com/lyuchanchan/duduk-project.git)
cd duduk-project

```

### 2. 환경 변수 설정 (.env)

프로젝트 루트 경로에 `.env` 파일을 생성하고 아래 내용을 채워주세요.

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL_COACHING=gemini-2.5-flash
GEMINI_MODEL_ANALYSIS=gemini-2.5-flash
GOOGLE_OAUTH_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_IDS=your-google-web-client-id.apps.googleusercontent.com
KAKAO_REST_API_KEY=your-kakao-rest-api-key
KAKAO_CLIENT_SECRET=your-kakao-client-secret
```

`GEMINI_API_KEY` 대신 `GOOGLE_API_KEY`도 사용할 수 있습니다. 코칭/분석 키를 분리하려면 `GEMINI_API_KEY_COACHING`, `GEMINI_API_KEY_ANALYSIS`를 설정하면 됩니다.

프론트엔드는 별도로 `frontend/.env.local`에 아래 값을 맞춰야 합니다.

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
NEXT_PUBLIC_KAKAO_REST_API_KEY=your-kakao-rest-api-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID`와 백엔드의 `GOOGLE_OAUTH_CLIENT_ID` 또는 `GOOGLE_OAUTH_CLIENT_IDS`는 같은 Google OAuth 프로젝트의 웹 클라이언트 ID여야 합니다.
`NEXT_PUBLIC_KAKAO_REST_API_KEY`는 카카오 Developers의 REST API 키여야 하고, 백엔드의 `KAKAO_REST_API_KEY`와 같은 앱 값을 사용해야 합니다.


### 3. 프로젝트 실행

Docker Compose를 이용하여 백엔드, 프론트엔드, 데이터베이스를 한 번에 실행합니다.

```bash
docker-compose up --build

```

실행이 완료되면 아래 주소로 접속할 수 있습니다.

* **Frontend**: [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000)
* **Backend API**: [http://localhost:8000](https://www.google.com/search?q=http://localhost:8000)

<br>

## 📂 프로젝트 구조 (Project Structure)

```text
duduk-project/
├── 🐳 docker-compose.yml      # 서비스 오케스트레이션 (DB, Backend, Frontend)
├── 📂 backend/                # Django REST Framework
│   ├── 📂 apps/               # 도메인별 앱 분리 (DDD 구조 지향)
│   │   ├── 👤 users/          # 사용자 인증 및 프로필
│   │   ├── 💳 transactions/   # 가계부 CRUD 및 예산 로직
│   │   ├── 🤖 coaching/       # Gemini 기반 AI 연동 및 프롬프트 관리
│   │   └── 🏆 challenges/     # 챌린지 로직
│   ├── 📂 config/             # Django 설정
│   ├── 📂 external/           # 외부 API 클라이언트 (Gemini)
│   └── 📄 requirements.txt
│
└── 📂 frontend/               # Next.js 16 App Router
    ├── 📂 src/
    │   ├── 📂 app/            # 페이지 라우팅 ((main), (auth))
    │   ├── 📂 components/     # 재사용 가능한 UI 컴포넌트
    │   ├── 📂 contexts/       # 전역 상태 관리 (AuthContext 등)
    │   └── 📂 lib/            # API 호출 함수 및 유틸리티
    └── 📄 package.json
```

.
