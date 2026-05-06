# Daily Study Bot

백엔드 개발자 취업 준비를 위한 **자동 학습 Slack 봇**

매일 아침 AI가 기술 면접 질문을 생성해 Slack으로 발송하고, 사용자가 답변하면 실시간 피드백을 제공합니다.

---

## 주요 기능

- **매일 08:00 KST** — AI가 백엔드 기술 질문 자동 생성 및 Slack 발송
- **매일 13:00 KST** — AI가 모범 답안 및 핵심 개념 정리 발송
- **실시간 피드백** — 사용자가 채널에 답변 입력 시 AI가 즉시 평가
- **학습 기록 자동 커밋** — 질문·답변·피드백·모범답안을 `logs/YYYY-MM-DD.md`로 GitHub 자동 커밋
- **이력 관리 레포 연동** — [`daily-study`](https://github.com/kimdonghuyn/daily-study) 레포에 XP 적립, 뱃지 해금, README 진행도 자동 업데이트

## 질문 유형

| 유형 | 설명 |
|------|------|
| 📖 개념 설명 | "왜", "어떻게", "언제"를 묻는 깊이 있는 개념 질문 |
| 🔧 문제 상황 | 실무에서 발생할 법한 장애/버그 시나리오 |
| 🎤 면접 질문 | 네카라쿠배 수준 기술 면접 질문 |

## 학습 토픽 (Phase 1 — Java / Spring Boot 기초)

JVM · OOP · SOLID · Spring IoC/DI/AOP · 트랜잭션 · DB 인덱스 · Redis · Kafka · MSA · OAuth2 · Docker/K8s 등 20개 토픽

---

## 아키텍처

```
GitHub Actions (cron)
  ├── 08:00 KST → Claude API → 질문 생성 → Slack 발송 → Redis 저장
  └── 13:00 KST → Claude API → 모범 답안 생성 → Slack 발송
                → Redis에서 질문/답변/피드백 수집
                → logs/YYYY-MM-DD.md → GitHub 커밋

Vercel Edge Function (api/slack.js)
  └── 사용자 Slack 메시지 감지
        → Claude API → 피드백 생성 → Redis 저장
        → Slack 스레드 응답

Upstash Redis
  └── 질문 / 사용자 답변 / AI 피드백 임시 저장 (48시간)

GitHub (logs/)
  └── 날짜별 학습 기록 영구 보관 (질문 · 답변 · 피드백 · 모범답안)
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

## 기술적 의사결정

### GitHub Actions를 스케줄러로 선택한 이유
별도 서버 없이 크론 스케줄링이 가능하고, `workflow_dispatch`로 수동 테스트도 가능하다. Vercel Cron은 무료 티어에서 횟수 제한이 있어 Actions를 선택했다.

### Vercel을 Slack 웹훅 호스팅으로 선택한 이유
Slack Events API는 항상 켜진 엔드포인트가 필요하다. GitHub Actions는 일회성 실행이라 이벤트 수신이 불가능하다. Vercel의 `waitUntil`을 활용해 Slack의 3초 타임아웃 안에 200을 먼저 응답하고, 백그라운드에서 Claude API를 호출하는 방식으로 해결했다.

```js
// 3초 안에 응답 → 백그라운드에서 AI 처리
waitUntil(handleMessage(event));
return new Response(null, { status: 200 });
```

### Edge Runtime을 선택한 이유 (Node.js Runtime → 전환)
처음엔 Node.js Runtime으로 구현했지만 Slack 서명 검증이 계속 실패했다. Vercel의 Node.js Runtime은 body를 자동 파싱해 스트림을 소진하기 때문에 원본 raw body를 다시 읽을 수 없었다. `JSON.stringify(req.body)`로 재직렬화해도 Slack이 서명에 사용한 바이트와 미묘하게 달랐다. Edge Runtime으로 전환하면 `request.text()`로 파싱 전 raw body를 직접 읽을 수 있어 서명 검증이 정확하게 동작한다.

### Upstash Redis를 선택한 이유
GitHub Actions(모닝 질문 생성)와 Vercel(사용자 답변 수신)이 서로 다른 런타임이기 때문에 공유 상태 저장소가 필요하다. Serverless 환경에 최적화된 HTTP 기반 Redis로, 별도 커넥션 관리 없이 REST API로 접근할 수 있다.

### AI 엔진 선택 이력 (비용 vs 품질)
Claude API → Gemini(무료) → Groq(무료) → Claude API 순으로 교체했다. 무료 엔진의 피드백 품질 한계를 직접 검증한 후 Claude API로 회귀했다. `lib/claude.js` 단일 파일에 AI 로직을 캡슐화해 엔진 교체 시 다른 파일 변경 없이 대응 가능하도록 설계했다.

---

## 학습 이력 관리 시스템

매일 13:00 모범 답안 발송 이후 두 레포에 자동으로 기록이 쌓인다.

**`daily-study-bot/logs/YYYY-MM-DD.md`**
질문·답변·피드백·모범답안 전체 내용

**[`daily-study`](https://github.com/kimdonghuyn/daily-study) 레포 자동 업데이트**

| 파일 | 내용 |
|------|------|
| `profile.json` | XP·스트릭·스킬·뱃지 통계 원본 |
| `profile.md` | 상세 프로필 (자동 재생성) |
| `README.md` | XP 진행도 바, 스킬 레벨, 뱃지, 최근 학습 기록 |
| `daily-log/YYYY-MM-DD.md` | 날짜별 학습 일지 |

**XP 규칙**

| 질문 유형 | 기본 XP | 답변 없을 시 |
|----------|---------|------------|
| 개념 설명 | 10 XP | 5 XP |
| 문제 상황 | 15 XP | 10 XP |
| 면접 질문 | 15 XP | 10 XP |

스트릭 보너스: 3일 +10 XP / 7일 +30 XP / 30일 +100 XP

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
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 로컬 테스트

```bash
npm run morning    # 질문 생성 및 발송 테스트
npm run afternoon  # 모범 답안 발송 테스트
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
Slack 웹훅에서 서명 검증 실패로 401 반환. 총 두 번의 시도 끝에 해결.

**1차 시도 — `getRawBody()` 무한 대기**

Slack 서명 검증을 위해 `getRawBody()`로 raw body를 읽으려 했으나 함수가 타임아웃까지 응답 없이 대기.

원인: Vercel 비(非)Next.js 환경에서는 request body가 이미 파싱·소진된 상태로 전달됨.
`req.on('data', …)` 이벤트가 영구히 미발생.

임시 조치: `getRawBody()` 제거 후 `JSON.stringify(req.body)`로 재직렬화.

→ [커밋 `43ffc0d`](https://github.com/kimdonghuyn/daily-study-bot/commit/43ffc0dc7642471da6612e58da1faf5823ea1561)

**2차 시도 — `JSON.stringify` 재직렬화도 서명 불일치**

Vercel 로그로 expected/received 서명을 직접 비교한 결과 여전히 불일치 확인.

```
[slack] expected: v0=08c71b0d494c3...
[slack] received: v0=d25e6d3712135...
```

원인: Slack이 서명에 사용한 원본 바이트와 `JSON.stringify(req.body)`의 출력이 다름.
(key 순서, 공백, Unicode 이스케이프 등의 미세한 차이)

**최종 해결 — Edge Runtime 전환**

`request.text()`로 파싱 전 raw body를 직접 읽을 수 있는 Edge Runtime으로 전환.
Node.js `crypto` 모듈 대신 Web Crypto API(`crypto.subtle`) 사용.

```js
// Node.js Runtime (실패) — 스트림 이미 소진, 재직렬화 불일치
const rawBody = JSON.stringify(req.body);

// Edge Runtime (성공) — 파싱 전 raw body 직접 획득
const rawBody = await request.text();
const body = JSON.parse(rawBody);
```

→ [커밋 `4945444`](https://github.com/kimdonghuyn/daily-study-bot/commit/4945444)

---

### 2. `@upstash/redis` 자동 역직렬화로 인한 JSON 이중 파싱 오류

**문제**
오후 모범 답안 워크플로우 실행 시 `SyntaxError: "[object Object]" is not valid JSON` 발생.

**원인**
`@upstash/redis`는 저장된 JSON을 자동으로 역직렬화함.
이미 객체 상태인 값에 `JSON.parse()` 재호출 → 예외 발생.

**해결**
타입 가드로 이중 파싱 방지.

```js
// Before
return JSON.parse(await redis.get(key));

// After
const data = await redis.get(key);
return typeof data === 'string' ? JSON.parse(data) : data;
```

→ [커밋 `120ff20`](https://github.com/kimdonghuyn/daily-study-bot/commit/120ff2092fd629eb73291ee78260cab7f49c56dd)

---

### 3. Slack Block Kit 3,000자 제한으로 인한 메시지 전송 실패

**문제**
AI가 생성한 모범 답안이 Slack `section` 블록 3,000자 제한 초과 → 메시지 잘림 또는 전송 실패.

**해결**
`splitTextBlocks()` 헬퍼 구현: 줄바꿈 기준으로 2,900자 단위 분할 후 다중 블록 배열로 전송.

```js
function splitTextBlocks(text, limit = 2900) {
  const blocks = [];
  let remaining = text;
  while (remaining.length > limit) {
    const cutAt = remaining.lastIndexOf('\n', limit);
    const splitAt = cutAt > 0 ? cutAt : limit;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: remaining.slice(0, splitAt) } });
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0)
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: remaining } });
  return blocks;
}
```

→ [커밋 `698f7fa`](https://github.com/kimdonghuyn/daily-study-bot/commit/698f7fab40452c3e545cd3e9f4f2d1b4c7ebbf66)

---

### 4. Slack 앱 권한 변경 후 이벤트 미수신

**문제**
Event Subscriptions URL이 Verified 상태임에도 사용자 메시지에 대한 이벤트가 전달되지 않음.

**원인**
OAuth 권한 스코프 변경 후 앱 재설치를 하지 않으면 Slack이 기존 토큰 기준으로 동작해 변경된 스코프가 적용 안 됨.
Slack 대시보드 상단 노란 배너("Please reinstall your app")가 신호였으나 무시.

**해결**
Slack 앱 대시보드 → Install App → Reinstall to Workspace 실행.

**교훈**
URL 검증(Verified ✓)과 이벤트 전달은 별개. 스코프 변경 시 반드시 재설치 필요.

---

### 5. AI 엔진 교체 이력 — 비용 vs 품질 트레이드오프

| 단계 | 엔진 | 이유 |
|------|------|------|
| 초기 | Claude API | 높은 응답 품질 |
| 변경 | Gemini API | 무료 티어 탐색 |
| 변경 | Groq (llama-3.3-70b) | 완전 무료, 빠른 응답 |
| 최종 | Claude API (`claude-haiku-4-5`) | 학습 피드백 정확도 우선 |

무료 엔진의 한계를 직접 검증 후 품질 기준으로 회귀.
`lib/claude.js` 단일 파일에 AI 로직 캡슐화 → 엔진 교체 시 다른 파일 무변경.

---

## 프로젝트 배경

백엔드 취업 준비 과정에서 꾸준한 기술 학습을 자동화하기 위해 제작했습니다.  
AI를 활용해 매일 다양한 유형의 질문을 생성하고, 답변에 즉각적인 피드백을 제공해 학습 효율을 높입니다.
