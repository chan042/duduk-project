# 윤택지수 대결 백엔드 아키텍처

## 1. 목적

이 문서는 현재 `duduk-project`의 인증 구조, 유저 스키마, 월간 윤택지수 생성 방식에 맞춰 `윤택지수 대결`을 구현하기 위한 백엔드 설계를 정리한 문서다.

이 문서에서 다루는 범위는 아래와 같다.

- 현재 로그인 방식에서 사용자를 어떻게 식별하고 친구를 찾을지
- 두 사용자가 서로의 미션 현황을 각자 기기에서 어떻게 볼지
- 대결용 데이터 모델
- 대결 신청, 수락, 만료, 진행, 결과 확정 로직
- 검증이 쉬운 고정 미션 12개
- 프론트 화면과 연결할 API

## 2. 현재 프로젝트 기준 사실

### 2-1. 인증 방식

현재 프로젝트는 아래 흐름으로 로그인한다.

- 프론트는 Google 로그인 후 Google Access Token을 받는다.
- 백엔드는 `/api/users/auth/google/`에서 Google UserInfo API로 검증한다.
- 검증 성공 시 JWT `access`, `refresh`를 발급한다.
- 프론트는 JWT를 `localStorage`에 저장하고 이후 모든 API에 `Authorization: Bearer ...`로 붙인다.
- 최종 사용자 정보는 `/api/users/profile/`로 가져온다.

즉, 윤택지수 대결 API는 로그인 수단을 따로 신경 쓸 필요가 없다.  
`request.user`만 신뢰하면 된다.

### 2-2. 현재 유저 스키마

현재 `User` 모델에서 대결에 실제로 쓸 수 있는 필드는 아래다.

| 필드 | 용도 |
|---|---|
| `id` | 내부 식별자 |
| `email` | 로그인 ID, 외부 공개 금지 |
| `username` | 기본 표시 이름 |
| `character_name` | 캐릭터 이름이 있으면 표시 이름으로 우선 사용 가능 |
| `character_type` | 기본 아바타 타입 |
| `profile_image` | 사용자 업로드 프로필 이미지 |
| `points` | 대결 보상 지급 대상 |
| `is_profile_complete` | 대결 참여 가능 여부 판단에 활용 가능 |
| `auth_provider`, `social_id` | 인증 정보, 외부 공개 금지 |

결론은 아래와 같다.

- 친구 검색에 `email`을 쓰면 안 된다.
- `social_id`도 절대 쓰면 안 된다.
- `username` 검색도 가능은 하지만, 현재 로그인 ID가 이메일 기반이므로 공개 검색 키로 쓰기엔 부적절하다.

따라서 대결용 공개 식별자는 별도로 둬야 한다.

## 3. 친구 찾기 방식

### 3-1. 결론

`BattleProfile.battle_code`를 새로 두고, 친구 찾기는 이 코드의 exact match로 처리한다.

### 3-2. 왜 별도 코드가 필요한가

- 현재 로그인 ID는 `email`이다.
- `username`은 서비스 표시명으로는 쓸 수 있지만 공개 검색 키로 쓰면 개인정보 노출과 오탐 가능성이 있다.
- 프로젝트에 친구 관계 테이블이 아직 없다.

따라서 가장 안전한 방식은 아래다.

1. 각 사용자에게 대결용 공개 키 `battle_code`를 1개 발급한다.
2. 사용자는 이 코드를 직접 친구에게 공유한다.
3. 친구는 검색 화면에 이 코드를 입력한다.
4. 백엔드는 exact match로 한 명만 반환한다.

### 3-3. `BattleProfile` 제안

| 필드 | 타입 | 설명 |
|---|---|---|
| `user` | OneToOne(User) | 사용자 연결 |
| `battle_code` | CharField(unique) | 친구 검색용 공개 키 |
| `active_battle` | FK(YuntaekBattle, null=True) | 현재 묶여 있는 대결 |
| `is_enabled` | Boolean | 대결 기능 사용 가능 여부 |
| `created_at` | DateTime | 생성 시각 |
| `updated_at` | DateTime | 수정 시각 |

### 3-4. 검색 응답에 노출할 정보

검색 결과에는 아래만 내려주는 것이 적절하다.

| 응답 필드 | 값 |
|---|---|
| `user_id` | 내부 ID |
| `display_name` | `character_name` 우선, 없으면 `username` |
| `profile_image_url` | 업로드 이미지가 있으면 그것 |
| `character_type` | 기본 캐릭터 타입 |

검색 결과에 내려주면 안 되는 값은 아래다.

- `email`
- `social_id`
- `points`
- 예산, 취미, 결혼 여부 같은 개인정보 필드

### 3-5. 검색 API

- `GET /api/battles/users/lookup/?battle_code=AB12CD34`

검증 규칙은 아래다.

- exact match만 허용
- 자기 자신 검색 불가
- 존재하지 않으면 404
- rate limit 적용 권장

## 4. 서로의 미션 현황을 기기에서 공유하는 방식

### 4-1. 기본 원칙

서로의 기기가 직접 통신하는 구조가 아니다.  
두 기기는 같은 백엔드 상태를 읽어가는 구조다.

즉, 공유 방식은 아래다.

1. 한 사용자가 미션을 성공한다.
2. 백엔드가 `BattleMission`, `BattleParticipant`, `YuntaekBattle`를 갱신한다.
3. 백엔드가 양쪽 사용자에게 알림을 저장한다.
4. 두 사용자는 각자 진행 화면 API를 다시 호출해 최신 상태를 본다.

### 4-2. 현재 프로젝트에 맞는 현실적인 방식

현재 프로젝트에는 웹소켓이나 SSE 구조가 없다.  
반면 알림은 이미 30초 polling 구조가 있다.

따라서 대결 진행 화면은 아래 조합이 가장 현실적이다.

- 진행 화면 오픈 중: `GET /api/battles/current/progress/`를 10~15초 polling
- 앱 전체 배경 상태: 기존 `NotificationContext`의 30초 unread polling 사용
- 미션 성공 직후: 백엔드가 `BATTLE` 알림 2건 생성

### 4-3. 진행 화면에서 보여줄 스코어

공식 윤택지수 점수가 아직 나오기 전에는 `미션 선점 개수`만 보여준다.

- 내가 미션 1개 먼저 성공, 상대 0개면 `1:0`
- 내가 2개, 상대 1개면 `2:1`

이 값은 진행 표시용이며 최종 승패 계산에 직접 쓰이지 않는다.  
최종 승패는 월간 공식 점수가 생성된 뒤 확정한다.

### 4-4. 진행 상태 공유용 필드

`YuntaekBattle` 또는 `BattleParticipant`에 아래 필드를 두면 polling 최적화가 쉽다.

| 필드 | 설명 |
|---|---|
| `state_version` | 상태가 바뀔 때마다 +1 |
| `updated_at` | 마지막 변경 시각 |

프론트는 마지막으로 받은 `state_version`과 비교해 UI를 갱신하면 된다.

## 5. 대결 도메인 모델

대결은 기존 `apps.challenges`에 억지로 넣지 말고 `apps.battles`로 분리하는 것이 맞다.

```text
backend/apps/battles/
  models.py
  views.py
  serializers.py
  urls.py
  tasks.py
  admin.py
  services/
    request_service.py
    mission_service.py
    result_service.py
    reward_service.py
    notification_service.py
```

### 5-1. `YuntaekBattle`

| 필드 | 타입 | 설명 |
|---|---|---|
| `requester` | FK(User) | 신청자 |
| `opponent` | FK(User) | 상대 |
| `status` | CharField | `REQUESTED / ACTIVE / WAITING_FOR_SCORE / COMPLETED / DRAW / REJECTED / CANCELED / EXPIRED` |
| `category` | CharField | `alternative / growth / health / challenge` |
| `score_key` | CharField | 공식 점수 키 |
| `target_year` | Integer | 대결 대상 연도 |
| `target_month` | Integer | 대결 대상 월 |
| `requested_at` | DateTime | 신청 시각 |
| `request_deadline_at` | DateTime | 해당 월 15일 23:59:59 KST |
| `accepted_at` | DateTime | 수락 시각 |
| `started_at` | DateTime | 대결 시작 시각 |
| `score_expected_at` | DateTime | 다음 달 1일 00:00 KST |
| `completed_at` | DateTime | 결과 확정 시각 |
| `winner` | FK(User, null=True) | 승자 |
| `is_draw` | Boolean | 무승부 여부 |
| `state_version` | Integer | 상태 버전 |
| `created_at` | DateTime | 생성 시각 |
| `updated_at` | DateTime | 수정 시각 |

### 5-2. `BattleParticipant`

| 필드 | 타입 | 설명 |
|---|---|---|
| `battle` | FK(YuntaekBattle) | 대결 연결 |
| `user` | FK(User) | 참가자 |
| `role` | CharField | `requester / opponent` |
| `mission_won_count` | Integer | 진행 화면 스코어용 |
| `mission_bonus_score` | Integer | 최종 계산용. 미션 1개당 +3 |
| `official_base_score` | Integer, null=True | 공식 월간 점수 |
| `final_score` | Integer, null=True | 공식 월간 점수 + 미션 보너스 |
| `official_score_snapshot` | JSONField | 결과 화면용 7개 항목 + 총점 |
| `profile_snapshot` | JSONField | 표시 이름, 프로필 이미지, 캐릭터 타입 |
| `created_at` | DateTime | 생성 시각 |

### 5-3. `BattleMissionTemplate`

MVP에서는 카테고리별 3개씩 고정 미션을 둔다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `category` | CharField | `alternative / growth / health / challenge` |
| `title` | CharField | 미션명 |
| `description` | TextField | 설명 |
| `verification_type` | CharField | 검증 방식 |
| `verification_config` | JSONField | 키워드, 횟수, 금액 등 |
| `display_order` | Integer | 1~3 |
| `is_active` | Boolean | 활성 여부 |

### 5-4. `BattleMission`

| 필드 | 타입 | 설명 |
|---|---|---|
| `battle` | FK(YuntaekBattle) | 대결 연결 |
| `template` | FK(BattleMissionTemplate) | 미션 원본 |
| `title_snapshot` | CharField | 대결 시점 제목 |
| `description_snapshot` | TextField | 대결 시점 설명 |
| `verification_snapshot` | JSONField | 대결 시점 규칙 |
| `status` | CharField | `OPEN / WON / EXPIRED` |
| `winner` | FK(User, null=True) | 먼저 성공한 사용자 |
| `won_at` | DateTime | 선점 시각 |
| `point_value` | Integer | 기본 3 |
| `created_at` | DateTime | 생성 시각 |

### 5-5. `BattleMissionAttempt`

| 필드 | 타입 | 설명 |
|---|---|---|
| `battle_mission` | FK(BattleMission) | 미션 연결 |
| `user` | FK(User) | 시도자 |
| `status` | CharField | `SUCCESS / FAILED / LOST_RACE / REJECTED` |
| `evidence_type` | CharField | 어떤 데이터로 검증했는지 |
| `evidence_payload` | JSONField | 증빙 데이터 |
| `created_at` | DateTime | 시도 시각 |

### 5-6. `BattleReward`

| 필드 | 타입 | 설명 |
|---|---|---|
| `battle` | FK(YuntaekBattle) | 대결 연결 |
| `user` | FK(User) | 보상 수령자 |
| `points` | Integer | 지급 포인트 |
| `reason` | CharField | `BATTLE_WIN / BATTLE_DRAW` |
| `created_at` | DateTime | 지급 시각 |

`unique_together (battle, user, reason)`으로 중복 지급을 막는다.

## 6. 점수 매핑

선택 가능한 대결 항목은 4개이고, 월간 공식 점수 키는 아래처럼 연결한다.

| 대결 항목 | enum | 공식 키 | 최대 점수 |
|---|---|---|---|
| 대안 행동 실현도 | `alternative` | `alternative_action` | 20 |
| 성장 | `growth` | `growth_consumption` | 10 |
| 건강 점수 | `health` | `health_score` | 15 |
| 챌린지 | `challenge` | `challenge_success` | 3 |

결과 화면에서는 아래 8개를 모두 보여준다.

- `budget_achievement`
- `alternative_action`
- `health_score`
- `growth_consumption`
- `leakage_improvement`
- `spending_consistency`
- `challenge_success`
- `total_score`

## 7. 로직 상세

### 7-1. 대결 신청

1. 로그인된 사용자가 친구의 `battle_code`를 입력한다.
2. 서버는 `BattleProfile` exact match로 상대를 찾는다.
3. 자기 자신이면 거절한다.
4. 현재 날짜가 매월 1일~15일인지 확인한다.
5. 신청자와 상대 `BattleProfile` 두 건을 `select_for_update()`로 잠근다.
6. 두 사람 모두 `active_battle is null`인지 확인한다.
7. 현재 연월을 `target_year`, `target_month`로 저장한다.
8. `request_deadline_at = 해당 월 15일 23:59:59 KST`로 설정한다.
9. `status=REQUESTED`로 대결 생성 후 두 사람 `active_battle`를 채운다.
10. 상대에게 대결 신청 알림을 만든다.

### 7-2. 대결 수락

1. 상대가 수락 API를 호출한다.
2. 다시 날짜가 15일 이내인지 확인한다.
3. `YuntaekBattle`, 양쪽 `BattleProfile`를 잠근다.
4. 카테고리에 맞는 고정 미션 3개를 `BattleMission`으로 복제한다.
5. `BattleParticipant` 2건을 만든다.
6. `profile_snapshot`에 표시 이름/프로필 이미지를 저장한다.
7. `accepted_at`, `started_at`을 기록한다.
8. `score_expected_at = 다음 달 1일 00:00 KST`로 저장한다.
9. `status=ACTIVE`로 전환한다.
10. 양쪽에 시작 알림을 만든다.

### 7-3. 신청 만료

1. 15일 23:59:59 KST가 지나면 `REQUESTED` 상태 대결은 모두 만료 대상이다.
2. 배치 task가 `status=EXPIRED`로 바꾼다.
3. 양쪽 `BattleProfile.active_battle`를 비운다.
4. 신청자와 상대에게 다음 달 다시 시작하라는 알림을 보낸다.

### 7-4. 진행 중 미션 판정

핵심 원칙은 `먼저 성공한 사용자만 점수를 가져간다`다.

처리 순서는 아래다.

1. 거래 등록, 챌린지 완료, 일일 체크, 사진 인증 같은 이벤트가 발생한다.
2. 해당 사용자의 활성 대결을 찾는다.
3. 열린 미션(`status=OPEN`)만 조회한다.
4. 각 미션의 `verification_snapshot`으로 충족 여부를 판정한다.
5. 충족한 미션이 있으면 그 `BattleMission` 행을 `select_for_update()`로 잠근다.
6. 이미 상대가 선점했으면 `LOST_RACE` 시도 이력만 남긴다.
7. 아직 아무도 선점하지 않았으면:
   - `winner=user`
   - `status=WON`
   - `won_at=now`
   - `BattleParticipant.mission_won_count += 1`
   - `BattleParticipant.mission_bonus_score += 3`
   - `YuntaekBattle.state_version += 1`
8. 양쪽 사용자에게 미션 선점 알림을 만든다.

### 7-5. 월간 공식 점수 생성 후 결과 확정

현재 코드 기준 월간 공식 점수는 `매월 1일 00:00 KST`에 전월분이 생성된다.

예시:

- 2026년 3월 대결 결과 확정 시점: 2026년 4월 1일 00:00 KST 이후

결과 확정 순서는 아래다.

1. 월간 점수 배치가 끝난다.
2. 이어서 `finalize_battles_for_month(year, month)` task를 실행한다.
3. `target_year`, `target_month`가 그 월인 대결을 모두 찾는다.
4. 두 사용자의 `MonthlyReport.score_snapshot`이 모두 `READY`인지 확인한다.
5. 선택 항목 공식 점수를 각각 `official_base_score`에 저장한다.
6. `final_score = official_base_score + mission_bonus_score`를 계산한다.
7. 높은 점수면 승자 확정, 같으면 무승부 처리한다.
8. 결과 화면용 7개 항목 + 총점을 `official_score_snapshot`에 저장한다.
9. 보상을 지급한다.
10. `status=COMPLETED` 또는 `status=DRAW`로 바꾼다.
11. 양쪽 `active_battle`를 비운다.
12. 결과 알림을 보낸다.

### 7-6. 보상 지급

- 승자 확정: 승자 1명에게 `500P`
- 무승부: 두 사용자에게 각각 `250P`

지급 순서는 아래다.

1. `BattleReward` 생성
2. `User.points += points`
3. `User.total_points_earned += points`

이 세 단계는 한 트랜잭션으로 묶는다.

## 8. 고정 미션 12개

MVP에서는 카테고리마다 아래 3개를 고정 배정하는 것이 가장 단순하다.

### 8-0. 용어 설명

문서에 나오는 `일일 체크`, `사진 인증`은 현재 프로젝트의 기존 챌린지 시스템 용어를 그대로 쓴 것이다.

- `일일 체크`
  - 챌린지를 수행한 날에 `ChallengeDailyLog.is_checked=True`가 기록된 상태를 뜻한다.
  - 쉽게 말하면 `그날 챌린지를 했다고 체크된 기록 1회`다.
  - 따라서 `일일 체크 3회 달성`은 `대결 기간 동안 체크된 날이 3번 누적됨`을 의미한다.

- `사진 인증`
  - 챌린지 수행 증빙 사진을 업로드하고, 그 사진이 검증 로직을 통과해 `photo_urls[].verified=True`로 저장된 상태를 뜻한다.
  - 쉽게 말하면 `사진 인증 챌린지 1번 성공`이다.

즉, 아래 미션 문구는 사용자에게는 이렇게 보이게 바꾸는 편이 좋다.

| 내부 표현 | 사용자 표시 문구 |
|---|---|
| 일일 체크 3회 달성 | 챌린지 체크 3번 먼저 완료 |
| 사진 인증 1회 통과 | 사진 인증 챌린지 1번 먼저 성공 |

### 8-1. 대안 행동 실현도

이 카테고리는 현재 윤택지수 계산에서 `AI 챌린지` 수행과 가장 직접적으로 연결된다.  
그래서 미션도 `source_type='ai'` 기준으로 검증한다.

| 순서 | 미션명 | 검증 방식 | 검증 규칙 |
|---|---|---|---|
| 1 | AI 챌린지 1개 먼저 완료 | `challenge_complete` | 대결 시작 후 `UserChallenge(source_type='ai', status='completed')` 1건 |
| 2 | AI 챌린지 체크 3번 먼저 완료 | `daily_check_count` | 대결 시작 후 AI 챌린지의 `ChallengeDailyLog.is_checked=True` 누적 3회 |
| 3 | AI 챌린지 사진 인증 1번 먼저 성공 | `photo_verified_count` | 대결 시작 후 AI 챌린지의 verified photo 1회 |

### 8-2. 성장

성장 항목은 self-development 성격의 소비를 거래 키워드로 먼저 잡는 것이 가장 구현이 쉽다.  
키워드 매칭 대상은 `item`, `store`, `memo`다.

권장 키워드:

- `책`
- `도서`
- `서점`
- `강의`
- `수업`
- `학원`
- `교육`
- `스터디`
- `자격증`
- `세미나`

| 순서 | 미션명 | 검증 방식 | 검증 규칙 |
|---|---|---|---|
| 1 | 성장 키워드 거래 1건 먼저 등록 | `transaction_keyword_count` | 키워드 매칭 거래 1건 |
| 2 | 성장 키워드 누적 20,000원 먼저 달성 | `transaction_keyword_amount` | 키워드 매칭 거래 누적 20,000원 |
| 3 | 성장 키워드 거래 3건 먼저 달성 | `transaction_keyword_count` | 키워드 매칭 거래 3건 |

### 8-3. 건강 점수

건강 항목도 거래 키워드 기반이 가장 검증이 쉽다.

권장 키워드:

- `샐러드`
- `과일`
- `비타민`
- `영양제`
- `헬스`
- `필라테스`
- `요가`
- `수영`
- `러닝`
- `도시락`

| 순서 | 미션명 | 검증 방식 | 검증 규칙 |
|---|---|---|---|
| 1 | 건강 키워드 거래 1건 먼저 등록 | `transaction_keyword_count` | 키워드 매칭 거래 1건 |
| 2 | 건강 키워드 누적 15,000원 먼저 달성 | `transaction_keyword_amount` | 키워드 매칭 거래 누적 15,000원 |
| 3 | 건강 키워드 거래 3건 먼저 달성 | `transaction_keyword_count` | 키워드 매칭 거래 3건 |

### 8-4. 챌린지

챌린지 항목은 기존 챌린지 모델을 그대로 활용하면 된다.

| 순서 | 미션명 | 검증 방식 | 검증 규칙 |
|---|---|---|---|
| 1 | 챌린지 1개 먼저 완료 | `challenge_complete` | 대결 시작 후 `UserChallenge(status='completed')` 1건 |
| 2 | 챌린지 체크 3번 먼저 완료 | `daily_check_count` | 대결 시작 후 `ChallengeDailyLog.is_checked=True` 누적 3회 |
| 3 | 챌린지 사진 인증 1번 먼저 성공 | `photo_verified_count` | 대결 시작 후 verified photo 1회 |

## 9. 미션 검증 이벤트 연결

현재 프로젝트에는 이미 거래 저장과 챌린지 progress 갱신 signal이 있다.  
대결 미션도 같은 이벤트를 다시 활용하면 된다.

### 9-1. 거래 기반 미션

트리거:

- `Transaction` 생성

사용 데이터:

- `item`
- `store`
- `memo`
- `amount`
- `date`

### 9-2. 챌린지 완료 기반 미션

트리거:

- `UserChallenge.status`가 `completed`로 바뀜

사용 데이터:

- `source_type`
- `completed_at`

### 9-3. 일일 체크 기반 미션

트리거:

- `ChallengeDailyLog.is_checked=True` 저장

### 9-4. 사진 인증 기반 미션

트리거:

- `ChallengeDailyLog.photo_urls` 중 verified photo 저장

## 10. API 설계

### 10-1. 프로필/친구 찾기

- `GET /api/battles/profile/me/`
  - 내 `battle_code`, 현재 대결 요약
- `POST /api/battles/profile/issue-code/`
  - 대결 코드 생성 또는 재발급
- `GET /api/battles/users/lookup/?battle_code=AB12CD34`
  - exact match 검색

### 10-2. 신청/응답

- `POST /api/battles/requests/`
  - body: `opponent_code`, `category`
- `POST /api/battles/{battle_id}/accept/`
- `POST /api/battles/{battle_id}/reject/`
- `POST /api/battles/{battle_id}/cancel/`

### 10-3. 진행/결과

- `GET /api/battles/current/`
- `GET /api/battles/current/progress/`
- `GET /api/battles/{battle_id}/result/`
- `GET /api/battles/history/`

## 11. 프론트 응답 예시

### 11-1. 친구 검색 결과

```json
{
  "user_id": 7,
  "display_name": "김윤택",
  "profile_image_url": null,
  "character_type": "char_dog"
}
```

### 11-2. 진행 화면

```json
{
  "battle_id": 12,
  "status": "ACTIVE",
  "category": "health",
  "target_year": 2026,
  "target_month": 3,
  "state_version": 5,
  "result_ready": false,
  "me": {
    "name": "홍길동",
    "mission_won_count": 1,
    "mission_bonus_score": 3,
    "current_score": 1
  },
  "opponent": {
    "name": "김철수",
    "mission_won_count": 0,
    "mission_bonus_score": 0,
    "current_score": 0
  },
  "missions": [
    {
      "id": 101,
      "title": "건강 키워드 거래 1건 먼저 등록",
      "description": "샐러드, 과일, 비타민, 헬스 등 건강 관련 거래 1건을 먼저 등록하세요.",
      "status": "WON",
      "winner_name": "홍길동",
      "point_value": 3
    }
  ]
}
```

### 11-3. 결과 화면

```json
{
  "battle_id": 12,
  "status": "COMPLETED",
  "category": "health",
  "target_year": 2026,
  "target_month": 3,
  "winner_user_id": 1,
  "winner_name": "홍길동",
  "is_draw": false,
  "reward_policy": {
    "winner_points": 500,
    "draw_points_each": 250
  },
  "me": {
    "official_base_score": 12,
    "mission_bonus_score": 6,
    "final_score": 18
  },
  "opponent": {
    "official_base_score": 10,
    "mission_bonus_score": 3,
    "final_score": 13
  },
  "score_breakdown": [
    { "key": "budget_achievement", "label": "예산 달성률", "max_score": 35, "me": 30, "opponent": 25 },
    { "key": "alternative_action", "label": "대안 행동 실현도", "max_score": 20, "me": 18, "opponent": 17 },
    { "key": "health_score", "label": "건강 점수", "max_score": 15, "me": 12, "opponent": 10 },
    { "key": "growth_consumption", "label": "성장", "max_score": 10, "me": 9, "opponent": 8 },
    { "key": "leakage_improvement", "label": "필수 지출", "max_score": 10, "me": 10, "opponent": 6 },
    { "key": "spending_consistency", "label": "소비 일관성", "max_score": 7, "me": 7, "opponent": 6 },
    { "key": "challenge_success", "label": "챌린지", "max_score": 3, "me": 1, "opponent": 2 }
  ],
  "total_score": {
    "me": 87,
    "opponent": 74,
    "max_score": 100
  }
}
```

## 12. 알림 설계

현재 알림 시스템을 그대로 확장해서 `BATTLE` 타입을 추가하면 된다.

필요한 알림은 아래다.

- 대결 신청 도착
- 대결 신청 수락
- 대결 신청 거절
- 15일 미수락으로 신청 만료
- 다음 달 다시 시작 안내
- 미션 선점
- 결과 확정
- 승리 보상 지급
- 무승부 보상 지급

`Notification.get_redirect_url()`에는 아래 연결이 필요하다.

- 대결 신청/진행 알림: `/challenge-battle/progress`
- 대결 결과 알림: `/challenge-battle/result` 또는 `/challenge-battle/result2`

## 13. 배치와 연동

### 13-1. 15일 만료 task

매일 1회 또는 매시 1회 아래를 실행한다.

- `REQUESTED` 상태
- `request_deadline_at < now`

대상 대결을 `EXPIRED`로 바꾸고 `active_battle`를 비운다.

### 13-2. 월간 점수 결과 확정 task

현재 `generate_monthly_reports_for_all_users()`가 끝난 뒤 아래 task를 이어서 실행한다.

- `finalize_battles_for_month(year, month)`

이 task가 해당 월 대결 결과를 확정한다.

## 14. 구현 순서

1. `apps.battles` 앱 생성
2. `BattleProfile`, `YuntaekBattle`, `BattleParticipant`, `BattleMission*`, `BattleReward` 모델 구현
3. `battle_code` 발급/검색 API 구현
4. 신청/수락/거절/취소/만료 로직 구현
5. 진행 화면 polling API 구현
6. 미션 판정 로직 구현
7. 월간 점수 배치 후 결과 확정 로직 구현
8. 보상 지급 구현
9. 알림 연결

## 15. 결론

현재 프로젝트 구조에서 윤택지수 대결은 아래 방식이 가장 현실적이다.

- 친구 찾기: `battle_code` exact match
- 상태 공유: 서버 상태 저장 + 진행 화면 polling + 기존 알림 polling
- 진행 스코어: 미션 선점 개수
- 최종 결과: 대상 월 공식 윤택지수 점수 + 미션 보너스
- 미션 구성: 거래/챌린지/일일체크/사진인증처럼 이미 수집되는 데이터만 사용

이 구조면 현재 로그인 방식과 유저 스키마를 그대로 유지하면서도 대결 기능을 무리 없이 붙일 수 있다.
