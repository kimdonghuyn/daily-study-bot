# Daily Study Bot

백엔드 취업 준비를 위한 자동 학습 Slack 봇.

매일 아침 8시에 질문을 던지고, 오후 1시에 모범 답안을 발송합니다.
사용자가 답변하면 즉시 AI 피드백을 제공합니다.

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
  └── 오늘의 질문 & 사용자 답변 임시 저장
```

## 질문 유형

| 유형 | 설명 |
|------|------|
| 📖 개념 설명 | "왜", "어떻게", "언제"를 묻는 깊이 있는 개념 질문 |
| 🔧 문제 상황 | 실무에서 발생할 법한 장애/버그 시나리오 |
| 🎤 면접 질문 | 네카라쿠배 수준 기술 면접 질문 |

## 토픽 풀

로드맵 Phase에 따라 토픽이 업데이트됩니다.
현재: Phase 1 (Java / Spring Boot 기초)

## 설정 방법

### 1. Slack App 생성
1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App
2. OAuth & Permissions → Bot Token Scopes: `chat:write`, `channels:history`, `channels:read`
3. Event Subscriptions → `message.channels` 구독
4. Event Subscriptions → Request URL: `https://{vercel-domain}/api/slack`
5. 채널에 봇 초대: `/invite @봇이름`

### 2. Upstash Redis 생성
1. [console.upstash.com](https://console.upstash.com) → Create Database
2. REST URL & Token 복사

### 3. Vercel 배포
```bash
npm i -g vercel
vercel --prod
```
Vercel 환경변수에 `.env.example` 항목 모두 추가

### 4. GitHub Secrets 설정
Repository → Settings → Secrets and variables → Actions:
- `ANTHROPIC_API_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_CHANNEL_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 5. 동작 확인
GitHub Actions → morning.yml → Run workflow (수동 실행 테스트)

## 환경변수

`.env.example` 참고

## 기술 스택

- **Runtime**: Node.js 20 (ES Modules)
- **Hosting**: Vercel (Serverless Functions)
- **Scheduler**: GitHub Actions (cron)
- **Storage**: Upstash Redis
- **AI**: Claude API (claude-opus-4-6)
- **Messaging**: Slack Web API
