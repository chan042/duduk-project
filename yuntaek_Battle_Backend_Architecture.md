# 윤택지수 대결 백엔드 아키텍처

## 1. 문서 목적

이 문서는 현재 `duduk-project` 코드베이스에 구현된 윤택지수 대결 백엔드를 기준으로 정리한 운영 문서다.

- 대상 범위: `apps.battles`, `apps.notifications`, `apps.users`, `apps.challenges`, `apps.transactions` 중 윤택지수 대결과 직접 연결되는 부분
- 기준 관점: "지금 DB에 무엇이 저장되는가", "사용자 액션과 배치가 어떤 순서로 상태를 바꾸는가", "어떤 필드가 원본이고 어떤 필드가 캐시/스냅샷인가"
- 제외 범위: 프론트 세부 UI 구현, 일반 챌린지 전체 설계, 전체 유저/인증 시스템 상세

이 문서는 설계 제안서가 아니라 현재 구현 상태를 설명하는 문서다. 따라서 실제 서비스 동작, 배치, 알림, 미션 판정 규칙, 최근 보완 사항을 코드 기준으로 반영한다.

## 2. 한눈에 보기

- 윤택지수 대결은 두 사용자가 한 달 동안 특정 카테고리 점수와 미션 보너스를 겨루는 1:1 대결이다.
- 대결 카테고리는 `대안 행동 실현도`, `성장`, `건강 점수`, `챌린지` 4개다.
- 각 카테고리마다 고정 미션 3개가 있고, 총 12개의 `BattleMissionTemplate`을 시드로 관리한다.
- 실제 대결이 시작되면 템플릿을 `BattleMission` 스냅샷으로 복제해 사용한다.
- 신청 가능 기간은 운영 기준 매월 1일 00:00부터 15일 23:59:59까지다.
- 대결을 수락하면 즉시 `ACTIVE`가 되고, 해당 월 말까지 진행된다.
- 대결 결과는 다음 달 1일 00:00 이후 `WAITING_FOR_SCORE`로 전환된 뒤 배치에서 확정된다.
- 결과 확정은 배치가 수행하며, 결과 조회 API는 읽기 전용이다.
- 승자는 `500P`, 무승부는 양쪽 모두 `500P`, 결과 지연 후 확정되면 양쪽 모두 `200P` 보상한다.
- 무지출 streak 미션은 매일 00:01 KST에 전날 기준으로 정산한다.
- `BattleProfile.active_battle`, `pending_result_battle`는 진실 데이터가 아니라 캐시 포인터이며, 메인 조회 경로에서 reconcile 후 사용한다.

## 3. 핵심 개념

### 3-1. 대결 카테고리와 공식 점수 키

| 카테고리 | 저장값 | 월간 점수 breakdown 키 | 공식 점수 의미 |
| --- | --- | --- | --- |
| 대안 행동 실현도 | `alternative` | `alternative_action` | 윤택지수의 대안 행동 실현도 점수 |
| 성장 | `growth` | `growth_consumption` | 윤택지수의 성장 소비 점수 |
| 건강 점수 | `health` | `health_score` | 윤택지수의 건강 점수 |
| 챌린지 | `challenge` | `challenge_success` | 윤택지수의 챌린지 성공 점수 |

대결 최종 점수는 아래 규칙으로 계산한다.

- `official_base_score`: 해당 카테고리의 공식 윤택지수 점수
- `mission_bonus_score`: 미션 선점/무승부 결과로 쌓인 보너스
- `final_score = official_base_score + mission_bonus_score`

### 3-2. 대결 화면 흐름

- `search`: 배틀 코드 조회, 신청, 신청 대기, 신청 수신
- `progress`: 대결 진행 중 화면
- `result2`: 결과 확인 화면

백엔드는 `entry` API에서 사용자의 현재 상태를 보고 다음 화면을 결정한다.

### 3-3. 상태 모델

#### 대결 상태 (`YuntaekBattle.status`)

| 상태 | 의미 |
| --- | --- |
| `REQUESTED` | 신청 생성됨, 수락/거절/취소/만료 대기 |
| `ACTIVE` | 대결 진행 중 |
| `WAITING_FOR_SCORE` | 월 종료 후 결과 확정 대기 |
| `COMPLETED` | 승패 확정 완료 |
| `DRAW` | 무승부 확정 완료 |
| `REJECTED` | 상대가 거절 |
| `CANCELED` | 신청자가 취소 |
| `EXPIRED` | 15일 만료 |

#### 미션 상태 (`BattleMission.status`)

| 상태 | 의미 |
| --- | --- |
| `OPEN` | 아직 선점 전 |
| `WON` | 한 사용자가 먼저 달성 |
| `DRAW` | 동시에 달성해 무승부 |
| `EXPIRED` | 현재 코드에서는 정의만 있고 일반 흐름에서 적극 사용하지 않음 |

## 4. DB 저장 정보

이 장은 윤택지수 대결이 실제로 어떤 테이블과 필드에 저장되는지 정리한다.

### 4-1. `apps.battles` 핵심 테이블

#### 4-1-1. `BattleProfile`

사용자별 윤택지수 대결 프로필이다. 친구 찾기용 배틀 코드와 현재 진입 상태 캐시를 저장한다.

| 필드 | 의미 |
| --- | --- |
| `user` | 유저 1:1 연결 |
| `battle_code` | 친구 찾기용 8자리 코드. 대문자/숫자 조합 |
| `active_battle` | 현재 열려 있는 대결 캐시 포인터 |
| `pending_result_battle` | 결과를 아직 확인하지 않은 대결 캐시 포인터 |
| `is_enabled` | 배틀 기능 활성화 여부 |
| `created_at`, `updated_at` | 생성/수정 시각 |

중요한 점:

- `active_battle`, `pending_result_battle`는 진실 데이터가 아니라 캐시 포인터다.
- 실제 원본은 `YuntaekBattle.status`, `BattleParticipant.result_seen_at` 조합이다.
- 따라서 조회 시 `reconcile_battle_profile()`로 포인터를 보정한 뒤 써야 한다.

#### 4-1-2. `YuntaekBattle`

대결의 본체다. 신청, 진행, 결과, 월 대상, 승자, 상태를 저장한다.

| 필드 | 의미 |
| --- | --- |
| `requester` | 신청자 |
| `opponent` | 상대방 |
| `status` | 현재 대결 상태 |
| `category` | 대결 카테고리 |
| `score_key` | 월간 점수 breakdown 조회용 키 |
| `target_year`, `target_month` | 대결 대상 월 |
| `requested_at` | 신청 시각 |
| `request_deadline_at` | 신청 응답 마감 시각 |
| `pair_key` | 두 사용자 조합의 정규화 키 |
| `accepted_at` | 수락 시각 |
| `started_at` | 실제 대결 시작 시각 |
| `score_expected_at` | 결과 계산 기준 시각. 기본적으로 다음 달 1일 00:00 |
| `completed_at` | 결과 확정 시각 |
| `closed_at` | 대결 종료 시각 |
| `result_locked_at` | 결과 락 시각 |
| `winner` | 승자 user FK |
| `is_draw` | 무승부 여부 |
| `last_settlement_error` | 결과 확정 지연 사유 메시지 |
| `state_version` | 폴링/프론트 갱신용 버전 |
| `created_at`, `updated_at` | 생성/수정 시각 |

중요 제약:

- `requester != opponent`
- `pair_key`는 `REQUESTED`, `ACTIVE`, `WAITING_FOR_SCORE` 상태에서 unique다.
- 즉 같은 두 사용자는 동시에 열려 있는 대결을 두 개 가질 수 없다.

#### 4-1-3. `BattleParticipant`

대결 참가자별 스냅샷과 점수 누적 정보를 저장한다.

| 필드 | 의미 |
| --- | --- |
| `battle` | 소속 대결 |
| `user` | 참가 사용자 |
| `role` | `requester` / `opponent` |
| `mission_won_count` | 선점한 미션 수 |
| `mission_bonus_score` | 미션 보너스 총합 |
| `official_base_score` | 공식 윤택지수 카테고리 점수 |
| `final_score` | 공식 점수 + 미션 보너스 |
| `official_score_snapshot` | 결과 확정 시점의 월간 점수 스냅샷 |
| `profile_snapshot` | 대결 시작 시점의 참가자 프로필 스냅샷 |
| `result_seen_at` | 결과 확인 완료 시각 |
| `created_at` | 생성 시각 |

현재 구현 메모:

- `profile_snapshot`은 저장되지만, 이름 표시는 현재 유저 `username`을 기준으로 계산한다.
- `character_type`은 스냅샷 fallback을 사용한다.

#### 4-1-4. `BattleMissionTemplate`

카테고리별 고정 미션 원본이다.

| 필드 | 의미 |
| --- | --- |
| `category` | 소속 카테고리 |
| `title` | 미션명 |
| `description` | 설명 |
| `verification_type` | 판정 타입 |
| `verification_config` | 판정 설정 JSON |
| `display_order` | 카테고리 내 정렬 |
| `is_active` | 사용 여부 |

제약:

- `(category, display_order)` unique
- 현재 운영 미션은 카테고리당 3개, 총 12개

#### 4-1-5. `BattleMission`

실제 대결에 복제된 미션 스냅샷이다.

| 필드 | 의미 |
| --- | --- |
| `battle` | 소속 대결 |
| `template` | 원본 템플릿 |
| `title_snapshot` | 시작 시점 미션명 스냅샷 |
| `description_snapshot` | 시작 시점 설명 스냅샷 |
| `verification_snapshot` | 시작 시점 판정 기준 스냅샷 |
| `status` | `OPEN` / `WON` / `DRAW` / `EXPIRED` |
| `winner` | 선점 사용자 |
| `won_at` | 선점 확정 시각 |
| `win_evidence_snapshot` | 선점 근거 JSON |
| `point_value` | 미션 보너스 점수. 현재 기본 3점 |
| `created_at` | 생성 시각 |

중요한 점:

- 대결 시작 시 템플릿을 복제하므로, 이후 템플릿 수정이 이미 진행 중인 대결을 바꾸지 않는다.
- 한 번 `WON` 또는 `DRAW`가 된 미션은 이후 거래 수정/삭제로 되돌리지 않는다.

#### 4-1-6. `BattleReward`

대결 보상 이력을 저장한다.

| 필드 | 의미 |
| --- | --- |
| `battle` | 대상 대결 |
| `user` | 보상 수령 사용자 |
| `points` | 지급 포인트 |
| `reason` | `BATTLE_WIN`, `BATTLE_DRAW`, `BATTLE_DELAY_COMPENSATION` |
| `created_at` | 생성 시각 |

중요한 점:

- `BattleReward`는 이력 테이블이다.
- 보상 지급 시 `BattleReward` row 생성과 함께 `User.points`, `User.total_points_earned`도 실제로 증가해야 한다.
- `(battle, user, reason)` unique로 중복 지급을 막는다.

#### 4-1-7. `BattleMissionAttempt`

현재 MVP에서는 사용하지 않는다. 실제 진행 상태는 `BattleMission`, `BattleParticipant`, `YuntaekBattle` 조합으로 관리한다.

### 4-2. 대결이 참조하는 외부 테이블

#### 4-2-1. `User`

대결은 사용자 식별을 항상 `user_id`로 한다. 이름은 식별 기준이 아니다.

대결과 직접 연결되는 주요 필드:

| 필드 | 의미 |
| --- | --- |
| `id` | 사용자 식별자 |
| `username` | 현재 표시 이름 계산에 사용 |
| `email` | fallback 표시 이름 |
| `character_type` | 프로필/진행 화면 표시 |
| `character_name` | 스냅샷에 저장되지만 현재 핵심 표시 기준은 아님 |
| `points` | 현재 보유 포인트 |
| `total_points_earned` | 누적 적립 포인트 |

#### 4-2-2. `MonthlyReport`

월간 윤택지수 캐시 테이블이다. 대결 공식 점수는 여기의 `score_snapshot`을 읽는다.

| 필드 | 의미 |
| --- | --- |
| `user`, `year`, `month` | 스냅샷 대상 |
| `score_snapshot` | 윤택지수 JSON |
| `score_generated_at` | 생성 시각 |
| `score_status` | `PENDING` / `READY` / `FAILED` |
| `score_error` | 실패 사유 |
| `report_content` | 월간 리포트 콘텐츠 |

중요한 점:

- 결과 확정 시 `MonthlyReport.score_snapshot`이 없으면 배치에서 생성/저장할 수 있다.
- 결과 조회 API는 더 이상 이 생성을 직접 트리거하지 않는다.

#### 4-2-3. `ChallengeTemplate`

챌린지 카테고리 미션이 참조하는 기본 챌린지 원본이다.

대결과 직접 연결되는 주요 필드:

| 필드 | 의미 |
| --- | --- |
| `id` | DB PK |
| `name` | 사용자 노출 이름 |
| `code` | 대결 미션 판정용 고정 식별자 |
| `is_active` | 활성 여부 |
| `display_order` | 정렬 순서 |

중요한 점:

- 대결 미션은 더 이상 `template_id`를 원본 식별 기준으로 쓰지 않는다.
- 현재 기준은 `template_code`이며, legacy 데이터 호환을 위해 `template_name` fallback을 둔다.

#### 4-2-4. `UserChallenge`

실제 사용자가 시작/완료한 챌린지 데이터다.

대결과 직접 연결되는 주요 필드:

| 필드 | 의미 |
| --- | --- |
| `user` | 사용자 |
| `template` | 연결된 기본 챌린지 템플릿 |
| `source_type` | 챌린지 출처 |
| `status` | `saved` / `ready` / `active` / `completed` / `failed` |
| `started_at` | 시작 시각 |
| `completed_at` | 완료 시각 |

대결 미션에서 보는 값:

- AI 챌린지 시작/완료 미션: `started_at`, `completed_at`
- 챌린지 카테고리 미션: `template.code` 또는 `template.name`, `completed_at`

#### 4-2-5. `Transaction`

거래 기반 미션과 무지출 streak 정산의 원본 데이터다.

대결과 직접 연결되는 주요 필드:

| 필드 | 의미 |
| --- | --- |
| `user` | 사용자 |
| `category` | 거래 카테고리 |
| `amount` | 금액 |
| `date` | 거래 일자 |
| `created_at` | 실제 DB 생성 시각 |

중요한 점:

- 거래 미션 인정 기준은 `created_at >= battle.started_at`이다.
- 대결 시작 전 거래를 나중에 수정해도 거래 미션에 포함되지 않는다.
- 이미 `WON` 또는 `DRAW`된 미션은 이후 거래 삭제/수정으로 되돌리지 않는다.

#### 4-2-6. `Notification`

윤택지수 대결 알림은 기존 `Notification` 테이블의 `notification_type=BATTLE`로 저장한다.

대결과 직접 연결되는 주요 필드:

| 필드 | 의미 |
| --- | --- |
| `user` | 알림 대상 |
| `notification_type` | `BATTLE` |
| `title`, `message` | 노출 문구 |
| `event_code` | 세부 이벤트 코드 |
| `related_id` | 보통 battle id |
| `payload` | 추가 JSON |
| `is_read` | 읽음 여부 |
| `created_at` | 생성 시각 |

현재 대결 이벤트 코드:

- `BATTLE_REQUEST_RECEIVED`
- `BATTLE_REQUEST_ACCEPTED`
- `BATTLE_REQUEST_REJECTED`
- `BATTLE_REQUEST_CANCELED`
- `BATTLE_REQUEST_EXPIRED`
- `BATTLE_MISSION_WON`
- `BATTLE_OPPONENT_MISSION_WON`
- `BATTLE_STREAK_RESET`
- `BATTLE_RESULT_DELAYED`
- `BATTLE_RESULT_COMPLETED`
- `BATTLE_DELAY_COMPENSATION_GRANTED`

보관 정책:

- Notification 전체 retention은 90일이다.

### 4-3. 스냅샷과 캐시 포인터 정리

| 필드 | 종류 | 왜 저장하는가 |
| --- | --- | --- |
| `BattleParticipant.profile_snapshot` | 스냅샷 | 대결 시작 시점 프로필 보존 |
| `BattleMission.title_snapshot` | 스냅샷 | 템플릿 변경 후에도 기존 대결 유지 |
| `BattleMission.description_snapshot` | 스냅샷 | 동일 |
| `BattleMission.verification_snapshot` | 스냅샷 | 판정 기준 고정 |
| `BattleMission.win_evidence_snapshot` | 스냅샷 | 선점 근거 보존 |
| `BattleParticipant.official_score_snapshot` | 스냅샷 | 결과 확정 시점 공식 점수 보존 |
| `BattleProfile.active_battle` | 캐시 포인터 | 현재 진입 화면 결정을 빠르게 하기 위함 |
| `BattleProfile.pending_result_battle` | 캐시 포인터 | 결과 미확인 화면 진입을 빠르게 하기 위함 |

## 5. 작동 방식

### 5-1. 배틀 코드 발급과 진입

1. 사용자별로 `BattleProfile`을 1개 가진다.
2. `battle_code`는 고유한 8자리 코드로 생성된다.
3. 친구 찾기는 상대의 `battle_code`를 입력해 수행한다.
4. 메인 진입 API는 먼저 `BattleProfile`을 reconcile해서 실제 open battle / pending result battle과 포인터를 맞춘다.
5. 그 결과에 따라 `intro`, `search`, `progress`, `result` 화면으로 라우팅한다.

### 5-2. 대결 신청

신청 흐름:

1. 요청 시 먼저 만료된 `REQUESTED` 대결을 정리한다.
2. 운영 기준 신청 가능 기간인지 확인한다.
3. 상대 `battle_code`를 조회한다.
4. 신청자/상대 `BattleProfile`을 lock 후 reconcile한다.
5. 아래 blocker를 검사한다.

blocker 규칙:

- 자기 자신에게는 신청 불가
- 양쪽 `is_enabled`가 켜져 있어야 함
- 양쪽 모두 `pending_result_battle`이 없어야 함
- 양쪽 모두 다른 open battle이 없어야 함
- 같은 pair에 이미 `REQUESTED`, `ACTIVE`, `WAITING_FOR_SCORE` 대결이 있으면 안 됨

신청이 성공하면:

- `YuntaekBattle.status = REQUESTED`
- `requested_at`, `request_deadline_at`, `pair_key`, `state_version=1` 저장
- 양쪽 `BattleProfile.active_battle = battle`
- 상대방에게 `REQUEST_RECEIVED` 알림 발송

신청 마감:

- 운영 기준 `15일 23:59:59`
- `DEBUG=True`에서는 15일 이후 요청도 하루 연장 허용하는 개발용 예외가 있다.

### 5-3. 대결 수락

수락 흐름:

1. 먼저 만료 요청 정리를 수행한다.
2. 신청 만료 여부를 다시 체크한다.
3. 상대방만 수락 가능하다.
4. 수락 시 아래 값이 저장된다.

- `status = ACTIVE`
- `accepted_at = now`
- `started_at = now`
- `score_expected_at = 다음 달 1일 00:00`
- `state_version += 1`

수락 직후 생성되는 데이터:

- `BattleParticipant` 2개
- `BattleMission` 3개

미션 생성 방식:

- `BattleMissionTemplate`를 조회
- 템플릿이 없으면 `seed_battle_mission_templates()`를 먼저 호출
- 템플릿 제목/설명/검증 설정을 `BattleMission` 스냅샷으로 복제

알림:

- 신청자에게 `REQUEST_ACCEPTED`

### 5-4. 거절, 취소, 만료

#### 거절

- 상대방만 가능
- `status = REJECTED`
- `closed_at = now`
- 양쪽 `active_battle` 비움
- 신청자에게 `REQUEST_REJECTED`

#### 취소

- 신청자만 가능
- `status = CANCELED`
- `closed_at = now`
- 양쪽 `active_battle` 비움
- 상대방에게 `REQUEST_CANCELED`

#### 만료

- `REQUESTED` 상태에서 `request_deadline_at < now`면 `EXPIRED`
- `closed_at = now`
- 양쪽 `active_battle` 비움
- 양쪽 모두 `REQUEST_EXPIRED` 알림

자동 만료 배치:

- 매월 16일 00:01 KST에 `expire_requested_battles`

### 5-5. 진행 중 미션 판정

진행 중 미션은 크게 세 가지로 나뉜다.

#### 5-5-1. 거래 기반 미션

대상:

- 교육/학습 거래 1건 먼저 등록
- 교육/학습 누적 20,000원 먼저 달성
- 교육/학습 거래 3건 먼저 달성
- 의료/건강 거래 1건 먼저 등록

판정 원칙:

- 대상 월의 거래만 본다.
- 반드시 `created_at >= battle.started_at`인 거래만 인정한다.
- 과거 거래를 나중에 수정해도 미션에는 포함되지 않는다.
- 인정된 순간 `BattleMission.status = WON`, `winner`, `won_at`, `win_evidence_snapshot` 저장
- 승자의 `BattleParticipant.mission_won_count`, `mission_bonus_score` 증가
- `YuntaekBattle.state_version` 증가
- 알림 발송

중요한 운영 규칙:

- 한 번 선점된 거래 미션은 이후 거래 수정/삭제로 되돌리지 않는다.

#### 5-5-2. 무지출 streak 미션

대상:

- 카페/간식 3일 연속 무지출 먼저 달성
- 술/유흥 7일 무지출 먼저 달성

판정 원칙:

- 대결 시작 당일은 제외하고, `battle.started_at`의 다음 날부터 첫 full day로 본다.
- 매일 00:01 KST에 전날 기준으로 정산한다.
- 해당 카테고리의 일자별 지출 합이 0이면 streak를 누적한다.
- 양쪽이 같은 날 streak를 채우면 `DRAW`
- 먼저 채운 사람만 있으면 `WON`

streak 리셋 알림:

- 전날 해당 카테고리 지출이 있었고
- 그 전날까지 streak가 1일 이상 쌓여 있었다면
- `STREAK_RESET` 알림을 보낸다.

주의:

- 리셋 알림은 "미션 실패"가 아니라 "연속 기록 리셋" 안내다.
- 같은 배치 재실행으로 중복 알림이 나가지 않도록 중복 방지 로직이 있다.

#### 5-5-3. 챌린지 완료 기반 미션

대상:

- 3일 연속 무지출 챌린지 성공
- 3만원의 행복 챌린지 성공
- 무00의 날 챌린지 성공

판정 원칙:

- `UserChallenge.status = completed`
- `completed_at >= battle.started_at`
- `template.code`가 미션이 요구하는 `template_code`와 일치

legacy 호환:

- 옛 데이터는 `template_name` fallback으로도 읽는다.
- 아주 오래된 스냅샷이 `template_id`만 들고 있어도 evaluator fallback이 일부 남아 있지만, 현재 기준 식별자는 `template_code`다.

#### 5-5-4. AI 챌린지 시작/완료 기반 미션

대상:

- AI 챌린지 1개 먼저 시작
- AI 챌린지 1개 먼저 완료
- AI 챌린지 2개 먼저 완료

판정 원칙:

- `UserChallenge.started_at` 또는 `completed_at`
- `battle.started_at` 이후 시점만 인정
- 현재 evaluator는 `source_type="ai"` 기준으로 조회한다.

### 5-6. 진행 화면 데이터 구성

진행 화면은 `ACTIVE` 또는 `WAITING_FOR_SCORE` 상태의 최근 대결을 기준으로 구성한다.

진행 응답 핵심 필드:

- `battle_id`, `status`, `category`, `target_year`, `target_month`
- `state_version`
- `d_day`
- `battle_end_at`
- `score_expected_at`
- `me`, `opponent`
- `missions`

현재 진행 화면 규칙:

- `d_day`는 월말이 아니라 `score_expected_at` 기준이다.
- 예를 들어 결과가 4월 1일에 나오면 3월 31일은 `D-1`이다.
- 진행 화면의 `current_score`는 현재 구현상 `mission_won_count`와 동일하게 내려간다.

### 5-7. 월 종료 후 `WAITING_FOR_SCORE` 전환

전환 조건:

- `status = ACTIVE`
- `score_expected_at <= now`

전환 배치:

- 매월 1일 00:00 KST

전환 시 처리:

- `status = WAITING_FOR_SCORE`
- `state_version += 1`

### 5-8. 결과 확정

결과 확정은 `WAITING_FOR_SCORE` 배치에서만 수행한다.

핵심 원칙:

- 결과 조회 API는 읽기 전용이다.
- `GET /result/`가 더 이상 `finalize_single_battle()`를 호출하지 않는다.

결과 확정 순서:

1. `BattleParticipant`를 lock
2. 양쪽 `MonthlyReport.score_snapshot` 확보
3. 카테고리 공식 점수 계산
4. `official_base_score`, `final_score`, `official_score_snapshot` 저장
5. 승패 또는 무승부 결정
6. `BattleReward` 생성 + `User.points`, `User.total_points_earned` 실제 적립
7. `YuntaekBattle` 종료 정보 저장
8. 양쪽 `active_battle` 비우기
9. 양쪽 `pending_result_battle = battle`
10. 결과 알림 발송

결과 확정 결과:

- 동점이면 `DRAW`, 양쪽 모두 `500P`
- 아니면 `COMPLETED`, 승자 `500P`

### 5-9. 결과 지연 처리

지연이 가능한 카테고리:

- `건강 점수`
- `성장`

지연 조건:

- 확보한 `score_snapshot.analysis_warnings`에 해당 카테고리 warning이 존재할 때

지연 시 처리:

- battle은 `WAITING_FOR_SCORE` 유지
- `last_settlement_error` 저장
- 최초 지연일 때만 `RESULT_DELAYED` 알림 발송

지연 후 다시 확정될 때:

- 양쪽 모두 `200P` 지연 보상 지급
- `DELAY_COMPENSATION_GRANTED` 알림 발송

새 유저 처리:

- 해당 월 거래가 전혀 없고 가입 시점상 신규 유저이면 AI 없이 zero snapshot을 만들어 사용한다.

### 5-10. 결과 조회와 결과 확인

#### 결과 조회

`GET /result/`는 상태에 따라 다르게 동작한다.

- `WAITING_FOR_SCORE`: `result_ready=false`, 지연 사유 메시지 반환
- `COMPLETED` / `DRAW`: 확정된 결과 payload 반환
- 그 외 상태: 404

#### 결과 확인

`POST /confirm-result/` 호출 시:

- 내 `BattleParticipant.result_seen_at` 저장
- 내 `BattleProfile.pending_result_battle` 해제
- 양쪽 다 확인했으면 남아 있는 `pending_result_battle`도 정리

## 6. 고정 미션 12개

윤택지수 대결 미션은 시드 기반으로 관리한다.

### 6-1. 대안 행동 실현도

1. AI 챌린지 1개 먼저 시작
2. AI 챌린지 1개 먼저 완료
3. AI 챌린지 2개 먼저 완료

### 6-2. 성장

1. 교육/학습 카테고리 거래 1건 먼저 등록
2. 교육/학습 카테고리 누적 20,000원 먼저 달성
3. 교육/학습 카테고리 거래 3건 먼저 달성

### 6-3. 건강 점수

1. 의료/건강 카테고리 거래 1건 먼저 등록
2. 카페/간식 카테고리 3일 연속 무지출 먼저 달성
3. 술/유흥 카테고리 7일 무지출 먼저 달성

### 6-4. 챌린지

1. 3일 연속 무지출 챌린지 성공
2. 3만원의 행복 챌린지 성공
3. 무00의 날 챌린지 성공

### 6-5. 시드 관리 원칙

- 원본: `BattleMissionTemplate`
- 실행 시점 데이터: `BattleMission`
- 챌린지 카테고리 미션은 `template_code`로 연결한다.
- 이미 시작된 대결은 스냅샷을 쓰므로 템플릿 수정이 즉시 반영되지 않는다.
- 템플릿 수정 후 새 대결부터 반영하려면 시드 갱신이 필요하다.

## 7. 윤택지수 점수 연동

### 7-1. `MonthlyReport.score_snapshot`

`MonthlyReport.score_snapshot`은 해당 월의 윤택지수 캐시다.

대표 구조:

```json
{
  "total_score": 78,
  "max_score": 100,
  "year": 2026,
  "month": 3,
  "breakdown": {
    "budget_achievement": 0,
    "alternative_action": 12,
    "spending_consistency": 0,
    "challenge_success": 8,
    "health_score": 15,
    "leakage_improvement": 0,
    "growth_consumption": 10
  },
  "analysis_warnings": []
}
```

대결에서 실제로 쓰는 것은:

- `breakdown[battle.score_key]`
- `analysis_warnings`

### 7-2. 공식 점수 생성 원칙

- `score_snapshot`이 이미 있으면 그대로 사용
- 없으면 결과 확정 배치에서 `ensure_score_snapshot()`로 생성
- 실패하면 `MonthlyReport.score_status = FAILED`
- 결과 조회 API는 이 생성을 수행하지 않음

### 7-3. battle 결과와 score snapshot의 관계

- 대결 중에는 월간 공식 점수를 미리 확정하지 않는다.
- 결과 확정 시점에 `official_base_score`와 `official_score_snapshot`을 `BattleParticipant`에 저장한다.
- 이후 원본 월간 리포트나 점수가 바뀌더라도 확정된 battle 결과는 스냅샷으로 보존된다.

## 8. API 정리

모든 battle API는 인증된 사용자 기준으로 동작한다.

### 8-1. 프로필/친구 찾기

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| `GET` | `/api/battles/profile/me/` | 내 battle profile, active battle, pending result battle 조회 |
| `POST` | `/api/battles/profile/issue-code/` | 새 battle code 발급 |
| `GET` | `/api/battles/users/lookup/?battle_code=...` | 상대 battle code 조회 |
| `GET` | `/api/battles/entry/` | 현재 화면 진입 상태 결정 |

### 8-2. 신청/응답

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| `POST` | `/api/battles/requests/` | 대결 신청 |
| `POST` | `/api/battles/{battle_id}/accept/` | 수락 |
| `POST` | `/api/battles/{battle_id}/reject/` | 거절 |
| `POST` | `/api/battles/{battle_id}/cancel/` | 취소 |

### 8-3. 진행/결과

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| `GET` | `/api/battles/current/` | 현재 대결 요약 |
| `GET` | `/api/battles/current/progress/` | 진행 화면 데이터 |
| `GET` | `/api/battles/{battle_id}/result/` | 결과 조회. 읽기 전용 |
| `POST` | `/api/battles/{battle_id}/confirm-result/` | 결과 확인 완료 |

## 9. 알림 설계

### 9-1. 신청/응답 알림

| 이벤트 코드 | 발송 시점 |
| --- | --- |
| `REQUEST_RECEIVED` | 신청 직후 상대에게 |
| `REQUEST_ACCEPTED` | 수락 직후 신청자에게 |
| `REQUEST_REJECTED` | 거절 직후 신청자에게 |
| `REQUEST_CANCELED` | 취소 직후 상대에게 |
| `REQUEST_EXPIRED` | 만료 직후 양쪽에게 |

### 9-2. 미션 알림

| 이벤트 코드 | 발송 시점 |
| --- | --- |
| `MISSION_WON` | 내가 먼저 미션 달성 |
| `OPPONENT_MISSION_WON` | 상대가 먼저 미션 달성 |
| `STREAK_RESET` | 무지출 streak가 지출로 리셋됨 |

미션 알림 규칙:

- 내 미션 성공 시 나에게 성공 알림
- 동시에 상대에게 "상대가 먼저 어떤 미션을 성공했다"는 알림
- 무지출 streak 리셋은 streak가 실제로 쌓여 있다가 끊긴 경우에만 발송

### 9-3. 결과 알림

| 이벤트 코드 | 발송 시점 |
| --- | --- |
| `RESULT_DELAYED` | 결과 확정이 지연되었을 때 |
| `RESULT_COMPLETED` | 결과 확정 완료 |
| `DELAY_COMPENSATION_GRANTED` | 지연 후 확정되며 200P 보상 지급 |

### 9-4. 알림 클릭 이동

현재 battle 알림은 대략 아래로 이동한다.

- 신청 수신: `search`
- 신청 수락: `progress`
- 미션 선점/리셋: `progress`
- 결과/지연/지연 보상: `result2`

## 10. 배치와 스케줄

윤택지수 대결 관련 Celery beat 스케줄은 다음과 같다.

| 배치 | 시각 | 역할 |
| --- | --- | --- |
| `expire_requested_battles` | 매월 16일 00:01 | 만료된 신청 정리 |
| `run_battle_zero_spend_settlement` | 매일 00:01 | 무지출 streak 미션 정산 |
| `run_battle_score_transition` | 매월 1일 00:00 | `ACTIVE -> WAITING_FOR_SCORE` 전환 |
| `run_battle_result_finalization` | 매시 10분 | `WAITING_FOR_SCORE` 결과 확정 재시도 |

운영 메모:

- 스케줄 정의의 원본은 `backend/config/celery.py`다.
- `backend/celerybeat-schedule`은 Celery beat가 만드는 로컬 상태 파일이지 소스 오브 트루스가 아니다.

## 11. 운영 명령어

### 11-1. 배틀 미션 시드

```powershell
docker compose exec backend python manage.py seed_battle_missions --force-update
```

### 11-2. 챌린지 시드

```powershell
docker compose exec backend python manage.py seed_challenges --force-update
```

### 11-3. 마이그레이션

```powershell
docker compose exec backend python manage.py migrate
```

### 11-4. 관련 프로세스 재시작

```powershell
docker compose restart backend celery_worker celery_beat
```

최소 재시작만 필요하면:

```powershell
docker compose restart celery_worker
docker compose restart celery_beat
```

## 12. 데이터 정합성 규칙과 주의사항

### 12-1. BattleProfile 포인터는 캐시다

- `active_battle`, `pending_result_battle`는 조회 최적화를 위한 포인터다.
- 메인 진입 경로와 프로필 응답은 먼저 `reconcile_battle_profile()`로 원본 상태를 다시 계산해야 한다.

### 12-2. 결과 조회 API는 읽기 전용이다

- `GET /result/`는 결과를 확정하지 않는다.
- 배치만 결과 확정을 수행한다.
- 이 원칙 덕분에 결과 조회 중 중복 AI 토큰 사용과 무거운 동기 확정 로직을 피한다.

### 12-3. 거래 미션은 대결 시작 이후 생성 거래만 인정한다

- 기준은 `created_at >= battle.started_at`
- 과거 거래 수정으로 미션을 선점할 수 없어야 한다.

### 12-4. 미션 확정은 되돌리지 않는다

- `BattleMission.status`가 `WON` 또는 `DRAW`가 되면 이후 거래 수정, 삭제, 챌린지 상태 변경으로 되돌리지 않는다.
- 알림과 보너스 점수, 진행 상태의 안정성을 위해서다.

### 12-5. 챌린지 미션 식별자는 `template_code`다

- `ChallengeTemplate.id`는 같은 의미의 챌린지가 재생성되면 바뀔 수 있다.
- 따라서 battle 미션 판정 기준은 `template_code`를 사용한다.
- legacy 호환을 위해 `template_name` fallback을 유지한다.

### 12-6. 무지출 streak는 다음 날부터 시작한다

- 대결 시작 당일은 full day가 아니므로 streak 계산에서 제외한다.
- 첫 집계 대상은 `started_at` 다음 날이다.
- 실제 판정은 매일 00:01에 전날 기준으로 반영된다.

### 12-7. D-day는 결과 발표일 기준이다

- 진행 화면의 D-day는 월말이 아니라 `score_expected_at` 기준이다.
- 따라서 결과 발표 전날이 `D-1`이다.

### 12-8. 보상은 이력만 남기면 안 된다

- `BattleReward` 생성만으로는 지급이 끝난 것이 아니다.
- 반드시 `User.points`, `User.total_points_earned`가 함께 증가해야 한다.
- `(battle, user, reason)` unique로 idempotency를 보장한다.

### 12-9. 표시 이름 정책

- 대결 식별은 항상 `user_id`로 한다.
- 현재 표시 이름은 실시간 `username` 기준이다.
- `profile_snapshot`은 저장되지만 이름 표시는 과거 시점 고정 정책으로 강제하지 않는다.

## 13. 요약

윤택지수 대결은 다음 네 축으로 이해하면 된다.

1. `YuntaekBattle`이 상태와 월 대상, 승패를 관리한다.
2. `BattleParticipant`가 참가자별 미션/공식 점수/결과 확인 상태를 저장한다.
3. `BattleMissionTemplate -> BattleMission` 구조가 "고정 원본 + 대결 스냅샷"을 만든다.
4. `MonthlyReport`, `UserChallenge`, `Transaction`, `Notification`이 외부 원본 데이터로 연결된다.

현재 구현에서 특히 중요한 운영 포인트는 아래다.

- 신청은 1~15일, 만료 정리는 16일 00:01 배치
- 무지출 미션은 매일 00:01 배치
- 결과 조회는 읽기 전용, 결과 확정은 배치 전용
- 거래 미션은 대결 시작 이후 생성 거래만 인정
- 챌린지 미션은 `template_code`로 식별
- 보상은 `BattleReward`와 `User.points`를 함께 갱신
- `BattleProfile` 포인터는 항상 reconcile 후 사용
