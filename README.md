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

## 프로젝트 배경

백엔드 취업 준비 과정에서 꾸준한 기술 학습을 자동화하기 위해 제작했습니다.  
AI를 활용해 매일 다양한 유형의 질문을 생성하고, 답변에 즉각적인 피드백을 제공해 학습 효율을 높입니다.
