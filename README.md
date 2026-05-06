# Daily Study Bot

백엔드 개발자 취업 준비를 위한 **자동 학습 Slack 봇**

매일 아침 AI가 기술 면접 질문을 생성해 Slack으로 발송하고, 사용자가 답변하면 실시간 피드백을 제공합니다.

---

## 주요 기능

- **매일 08:00 KST** — AI가 백엔드 기술 질문 자동 생성 및 Slack 발송
- **매일 13:00 KST** — AI가 모범 답안 및 핵심 개념 정리 발송
- **실시간 피드백** — 사용자가 채널에 답변 입력 시 AI가 즉시 평가

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
  ├── 08:00 KST → Claude API → 질문 생성 → Slack 발송
  └── 13:00 KST → Claude API → 모범 답안 생성 → Slack 발송

Vercel Serverless (api/slack.js)
  └── 사용자 Slack 메시지 감지
        → Claude API → 피드백 생성
        → Slack 스레드 응답

Upstash Redis
  └── 오늘의 질문 & 사용자 답변 임시 저장 (48시간)
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| Runtime | Node.js 20 (ES Modules) |
| AI | Claude API (`claude-haiku-4-5`) |
| Hosting | Vercel Serverless Functions |
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

### 1. Vercel Serverless 환경에서 raw body 스트림 소진 문제

**문제**
Slack 서명 검증을 위해 `getRawBody()`로 raw body를 읽으려 했으나, 함수가 타임아웃까지 응답 없이 대기.

**원인**
Vercel 비(非)Next.js 환경에서는 request body가 진입 시점에 이미 파싱·소진된 상태로 전달됨.
`req.on('data', …)` 이벤트가 영구히 미발생 → 함수 무한 대기.

**해결**
`getRawBody()` 제거, 파싱된 `req.body`를 `JSON.stringify()`로 재직렬화해 서명 생성.

```js
// Before — 스트림 소진으로 무한 대기
const rawBody = await getRawBody(req);

// After — 이미 파싱된 body 재직렬화
const rawBody = JSON.stringify(req.body);
```

→ [커밋 `43ffc0d`](https://github.com/kimdonghuyn/daily-study-bot/commit/43ffc0dc7642471da6612e58da1faf5823ea1561)

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

### 4. AI 엔진 교체 이력 — 비용 vs 품질 트레이드오프

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
