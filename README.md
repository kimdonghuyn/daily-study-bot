# Daily Study Bot

백엔드 개발자 취업 준비를 위한 **자동 학습 Slack 봇**

매일 아침 AI가 기술 면접 질문 3문제를 생성해 Slack으로 발송하고, 사용자가 답변하면 **정확도 기반 XP**와 실시간 피드백을 제공합니다.

> 📋 **포트폴리오 상세 기록** (기술적 의사결정 · 트러블슈팅 · 설계 배경) →
> [daily-study/portfolio/daily-study-bot.md](https://github.com/kimdonghuyn/daily-study/blob/master/portfolio/daily-study-bot.md)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **매일 08:00 KST** | AI가 백엔드 기술 질문 3문제 자동 생성 및 Slack 발송 |
| **매일 13:00 KST** | AI가 모범 답안 및 핵심 개념 정리 발송 |
| **실시간 피드백** | 사용자 답변 입력 시 AI가 0~100점 채점 + 즉시 피드백 |
| **정확도 기반 XP** | 점수 비율에 따라 최대 40 XP 획득 (3문제 합산) |
| **레벨 기반 난이도** | 현재 XP 레벨에 따라 질문 난이도 자동 조절 |
| **타겟 회사 시나리오** | 오늘의집·무신사·컬리·올리브영·배민 실무 맥락 장애 시나리오 |
| **학습 기록 자동 커밋** | 질문·답변·피드백·모범답안을 `logs/YYYY-MM-DD.md`로 GitHub 자동 커밋 |
| **이력 관리 레포 연동** | `daily-study` 레포에 XP 적립, 뱃지 해금, README 진행도 자동 업데이트 |

## Slack 커맨드

| 커맨드 | 설명 |
|--------|------|
| `!학습 [배운 내용]` | 오늘 학습 내용 기록 → AI가 토픽 매핑 → 내일 아침 해당 토픽 질문 발송 |
| `!상태` / `!프로필` | 현재 레벨 · XP · 스트릭 · 뱃지 즉시 조회 |
| _(일반 메시지)_ | 오늘의 질문에 대한 답변으로 인식 → 피드백 + XP 부여 |

## 질문 유형 (매일 3문제, 같은 토픽)

| 유형 | 설명 |
|------|------|
| 📖 개념 설명 | "왜", "어떻게", "언제"를 묻는 깊이 있는 개념 질문 |
| 🔧 문제 상황 | 오늘의집·무신사·컬리 등 타겟 회사 실무 장애 시나리오 |
| 🎤 면접 질문 | 꼬리 질문 3~4개 포함, 실제 면접관이 파고드는 방식 |

## XP · 레벨 시스템

| 항목 | 규칙 |
|------|------|
| **기본 XP** | 개념 10 + 문제 15 + 면접 15 = **하루 최대 40 XP** |
| **정확도 반영** | XP × (AI 채점 점수 / 100), 최소 5 XP |
| **미답변 패널티** | 5 XP |
| **스트릭 보너스** | 3일 +10 / 7일 +30 / 30일 +100 XP |

| 레벨 | 필요 XP | 질문 난이도 |
|------|---------|------------|
| Lv.1-2 | 0 ~ 249 | 3년차 실무 중심 |
| Lv.3-4 | 250 ~ 899 | 4-5년차, 트레이드오프 |
| Lv.5+ | 900~ | 시니어/아키텍트 |

## 학습 토픽 (Phase 1 — Java / Spring Boot 기초)

JVM · OOP · SOLID · Spring IoC/DI/AOP · 트랜잭션 · DB 인덱스 · Redis · Kafka · MSA · OAuth2 · Docker/K8s 등 20개 토픽

---

## 아키텍처

```
GitHub Actions (cron)
  ├── 08:00 KST → profile.json에서 레벨 조회
  │              → Redis에서 사용자 지정 토픽 확인 (!학습 커맨드로 설정 가능)
  │              → Claude API → 3문제 병렬 생성 → Slack 발송 (4개 메시지)
  │              → Redis 저장
  └── 13:00 KST → Claude API → 모범 답안 3개 병렬 생성
                → Slack 발송 (4개 메시지)
                → Redis에서 질문/답변/피드백/점수 수집
                → logs/YYYY-MM-DD.md → daily-study-bot GitHub 커밋
                → daily-study: XP·뱃지·README·daily-log·portfolio 자동 업데이트

Vercel Edge Function (api/slack.js)
  └── Slack 메시지 감지 (Web Crypto API 서명 검증)
        ├── "!학습 [내용]" → Claude가 토픽 매핑 → 학습 요약 응답 → 내일 토픽 Redis 저장
        ├── "!상태" / "!프로필" → Redis 캐시에서 프로필 즉시 조회
        └── 일반 메시지 → Claude API 채점(0~100) + 피드백 → Slack 스레드 응답
                        → Redis에 점수·피드백 저장

Upstash Redis
  └── question / answer / feedback / answer-score / topic-request / profile-cache (48h TTL)

GitHub (daily-study-bot/logs/, daily-study/)
  └── 날짜별 학습 기록 영구 보관
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| Runtime | Node.js 20 (ES Modules) |
| AI | Claude API (`claude-haiku-4-5`) |
| Hosting | Vercel Edge Functions |
| Scheduler | GitHub Actions (cron) |
| Storage | Upstash Redis |
| Messaging | Slack Web API |

---

## 설치 및 실행

### 1. 환경변수 설정

`.env.example`을 참고해 `.env` 파일 생성:

```env
ANTHROPIC_API_KEY=sk-ant-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL_ID=C...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
STUDY_GITHUB_TOKEN=ghp_...   # daily-study 레포 write 권한 PAT
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 로컬 테스트

```bash
node --env-file=.env scripts/morning.js    # 질문 생성 및 발송 테스트
node --env-file=.env scripts/afternoon.js  # 모범 답안 발송 테스트
```

### 4. Vercel 배포

```bash
npx vercel --prod
```

Vercel 환경변수에 `.env.example` 항목 모두 추가

### 5. GitHub Secrets 설정

Repository → Settings → Secrets and variables → Actions에 다음 추가:

- `ANTHROPIC_API_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_CHANNEL_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `STUDY_GITHUB_TOKEN`

### 6. Slack App 설정

1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App
2. OAuth & Permissions → Bot Token Scopes: `chat:write`, `channels:history`, `channels:read`
3. Event Subscriptions → `message.channels` 구독
4. Event Subscriptions → Request URL: `https://{vercel-domain}/api/slack`
5. 채널에 봇 초대: `/invite @봇이름`

---

## 트러블슈팅

### 1. Slack 서명 검증 실패 — raw body 재현 불가 문제 (2단계 디버깅)

**문제**
Slack 웹훅에서 서명 검증 실패로 401 반환.

**1차 시도 — `getRawBody()` 무한 대기**

Vercel 비(非)Next.js 환경에서는 request body가 이미 파싱·소진된 상태. `req.on('data', …)` 이벤트가 영구히 미발생.

임시 조치: `getRawBody()` 제거 후 `JSON.stringify(req.body)`로 재직렬화.

**2차 시도 — `JSON.stringify` 재직렬화도 서명 불일치**

Slack이 서명에 사용한 원본 바이트와 `JSON.stringify(req.body)` 출력이 다름 (key 순서, 공백, Unicode 이스케이프 차이).

**최종 해결 — Edge Runtime 전환**

`request.text()`로 파싱 전 raw body를 직접 읽는 Edge Runtime으로 전환. Node.js `crypto` 대신 Web Crypto API(`crypto.subtle`) 사용.

```js
// Edge Runtime (성공)
const rawBody = await request.text();
const body = JSON.parse(rawBody);
```

---

### 2. `@upstash/redis` 자동 역직렬화로 인한 JSON 이중 파싱 오류

**문제**
`SyntaxError: "[object Object]" is not valid JSON`

**원인**
`@upstash/redis`는 저장된 JSON을 자동으로 역직렬화. 이미 객체 상태인 값에 `JSON.parse()` 재호출.

**해결**
```js
const data = await redis.get(key);
return typeof data === 'string' ? JSON.parse(data) : data;
```

---

### 3. Slack Block Kit 3,000자 제한으로 인한 메시지 전송 실패

**문제**
AI가 생성한 모범 답안이 Slack `section` 블록 3,000자 제한 초과 → 메시지 잘림.

**해결**
`splitTextBlocks()` 헬퍼 구현: 줄바꿈 기준으로 2,900자 단위 분할 후 다중 블록으로 전송.

---

### 4. 3문제 하나의 메시지 → 블록 총량 한도 초과로 잘림

**문제**
3문제를 하나의 Slack 메시지에 담으면 질문 내용이 중간에 잘림. 각 질문이 800 토큰 분량으로 길어지면서 전체 블록 페이로드가 한도 초과.

**해결**
토픽 요약 헤더 1개 + 질문별 개별 메시지 3개로 분리 발송. 모범 답안도 동일 구조 적용.

```js
// Before: 하나의 blocks 배열에 3문제 모두 포함 → 잘림
// After: 질문별 개별 postMessage 호출
for (const q of questions) {
  await slack.chat.postMessage({ channel: CHANNEL, blocks: [...] });
}
```

---

### 5. UTC/KST 날짜 불일치 — 오후 워크플로우 "질문 없음" 오류

**문제**
오전 23:00 UTC(=08:00 KST)에 저장한 Redis 키가 오후 04:00 UTC(=13:00 KST)에 조회되지 않음.

**원인**
`new Date().toISOString()`은 UTC 기준 → 날짜가 하루씩 어긋남.

**해결**
```js
// 모든 날짜 계산을 KST 기준으로 통일
const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
const today = kst.toISOString().split('T')[0];
```

---

### 6. Slack 앱 권한 변경 후 이벤트 미수신

**문제**
Event Subscriptions URL이 Verified 상태임에도 사용자 메시지 이벤트가 전달되지 않음.

**원인**
OAuth 권한 스코프 변경 후 앱 재설치를 하지 않으면 변경된 스코프가 적용 안 됨.

**해결**
Slack 앱 대시보드 → Install App → Reinstall to Workspace 실행.

---

### 7. AI 엔진 교체 이력 — 비용 vs 품질 트레이드오프

| 단계 | 엔진 | 이유 |
|------|------|------|
| 초기 | Claude API | 높은 응답 품질 |
| 변경 | Gemini API | 무료 티어 탐색 |
| 변경 | Groq (llama-3.3-70b) | 완전 무료, 빠른 응답 |
| 최종 | Claude API (`claude-haiku-4-5`) | 학습 피드백 정확도 우선 |

무료 엔진의 한계를 직접 검증 후 품질 기준으로 회귀. `lib/claude.js` 단일 파일에 AI 로직 캡슐화 → 엔진 교체 시 다른 파일 무변경.

---

## 프로젝트 배경

백엔드 취업 준비 과정에서 꾸준한 기술 학습을 자동화하기 위해 제작했습니다.
AI를 활용해 매일 다양한 유형의 질문을 생성하고, 답변에 즉각적인 피드백을 제공해 학습 효율을 높입니다.
