import { cacheProfile } from './redis.js';

const OWNER = 'kimdonghuyn';
const REPO = 'daily-study';
const BRANCH = 'master';

const TOPIC_SKILL = {
  'JVM 동작 원리 및 GC': 'java',
  'OOP 4대 원칙 (캡슐화, 상속, 다형성, 추상화)': 'java',
  'SOLID 원칙': 'java',
  '동시성 문제와 Lock 전략': 'java',
  'Spring IoC / DI / Bean 생명주기': 'spring',
  'Spring AOP와 프록시 패턴': 'spring',
  '@Transactional 전파 수준과 롤백': 'spring',
  'Spring MVC 요청 처리 흐름': 'spring',
  'OAuth2 & JWT 인증 흐름': 'spring',
  'DB 인덱스 (B-Tree) 동작 원리': 'db',
  'ACID와 트랜잭션 격리 수준': 'db',
  'N+1 문제와 해결 방법': 'db',
  'Redis 자료구조와 사용 사례': 'db',
  '캐싱 전략 (Look-aside, Write-through, Write-back)': 'db',
  'Kafka 기본 개념 (Topic, Partition, Consumer Group)': 'kafka',
  'REST API 설계 원칙과 멱등성': 'msa',
  'MSA vs 모놀리식 트레이드오프': 'msa',
  'CAP 정리': 'msa',
  'Circuit Breaker 패턴': 'msa',
  'Docker & Kubernetes 기초': 'aws',
};

const TYPE_XP = { concept: 10, problem: 15, interview: 15 };

const LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500];
const SKILL_XP = [0, 50, 120, 210, 330, 500];

const SKILL_NAMES = {
  java:   '☕ Java / Kotlin',
  spring: '🍃 Spring Boot',
  db:     '🗄️ DB (MySQL, Redis)',
  kafka:  '📨 Kafka / 메시징',
  msa:    '🏗️ MSA / 아키텍처',
  aws:    '☁️ AWS / 인프라',
  cs:     '🧠 CS 기초',
};

const DEFAULT_PROFILE = {
  totalXP: 0,
  streak: 0,
  dayNumber: 0,
  lastStudyDate: null,
  questsCompleted: 0,
  skills: { java: 0, spring: 0, db: 0, kafka: 0, msa: 0, aws: 0, cs: 0 },
  badges: [],
};

// ── GitHub API helpers ────────────────────────────────────────────────────────

async function getFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: apiHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

async function putFile(path, content, message, sha) {
  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: BRANCH,
    committer: { name: 'Daily Study Bot', email: 'bot@daily-study-bot.app' },
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`GitHub PUT ${path} 실패: ${res.status} ${await res.text()}`);
}

function apiHeaders() {
  return {
    Authorization: `Bearer ${process.env.STUDY_GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'daily-study-bot',
  };
}

// ── 계산 유틸 ─────────────────────────────────────────────────────────────────

function calcLevel(xp, thresholds) {
  let lv = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) lv = i + 1;
    else break;
  }
  return lv;
}

function calcStreak(lastDate, streak, today) {
  if (!lastDate) return 1;
  const diff = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
  if (diff === 1) return streak + 1;
  if (diff === 0) return streak;
  return 1;
}

function checkBadges(profile) {
  const earned = new Set(profile.badges);
  const newly = [];
  const add = (badge, cond) => { if (!earned.has(badge) && cond) newly.push(badge); };
  const skillLv = (s) => calcLevel(profile.skills[s] || 0, SKILL_XP);

  add('🔥 첫 불꽃',        profile.questsCompleted >= 1);
  add('📅 3일 연속',        profile.streak >= 3);
  add('💪 일주일 전사',     profile.streak >= 7);
  add('🗓️ 한 달의 습관',   profile.streak >= 30);
  add('🚀 취준생의 각오',   profile.totalXP >= 100);
  add('💎 꾸준함의 증거',   profile.totalXP >= 500);
  add('☕ Java 견습생',     skillLv('java') >= 3);
  add('🍃 Spring 마스터',   skillLv('spring') >= 5);
  add('🗄️ DB 장인',        skillLv('db') >= 5);
  add('📨 메시지 전령',     skillLv('kafka') >= 3);
  add('🏗️ 아키텍트',       skillLv('msa') >= 5);
  add('☁️ 클라우드 라이더', skillLv('aws') >= 3);

  return newly;
}

// ── 렌더링 ────────────────────────────────────────────────────────────────────

function renderProfileMd(p) {
  const lv = calcLevel(p.totalXP, LEVEL_XP);
  const nextXP = LEVEL_XP[lv] ?? '🏆';
  const badgeStr = p.badges.length > 0 ? p.badges.join(' · ') : '없음';

  const skillRows = Object.entries(SKILL_NAMES).map(([k, name]) => {
    const xp = p.skills[k] || 0;
    const slv = calcLevel(xp, SKILL_XP);
    const next = SKILL_XP[slv] ?? '★';
    return `| ${name} | Lv.${slv} | ${xp} / ${next} |`;
  }).join('\n');

  const badgeSection = p.badges.length > 0
    ? p.badges.map(b => `- ${b}`).join('\n')
    : '_아직 획득한 뱃지가 없습니다. 퀘스트를 완료해 첫 뱃지를 획득하세요!_';

  return `# 👤 김동현 — 개발자 성장 프로필

## 캐릭터 스탯

| 항목 | 값 |
|------|-----|
| **레벨** | Lv. ${lv} |
| **총 XP** | ${p.totalXP} / ${nextXP} |
| **연속 학습일** | ${p.streak}일 🔥 |
| **완료 퀘스트** | ${p.questsCompleted}개 |
| **획득 뱃지** | ${badgeStr} |

---

## 스킬 레벨

| 스킬 | 레벨 | XP |
|------|------|-----|
${skillRows}

---

## 레벨업 기준 (총 XP)

| 레벨 | 필요 XP |
|------|--------|
| Lv.1 | 0 |
| Lv.2 | 100 |
| Lv.3 | 250 |
| Lv.4 | 500 |
| Lv.5 | 900 |
| Lv.6 | 1,400 |
| Lv.7 | 2,000 |
| Lv.8 | 2,700 |
| Lv.9 | 3,500 |
| Lv.10 | 🏆 취업 성공! |

---

## 획득 뱃지

${badgeSection}

---

## 회사별 공략 진행도

| 회사 | 진행도 | 상태 |
|------|--------|------|
| 오늘의집 | ░░░░░░░░░░ 0% | 미시작 |
| 무신사 | ░░░░░░░░░░ 0% | 미시작 |
| 컬리 | ░░░░░░░░░░ 0% | 미시작 |
| 올리브영 | ░░░░░░░░░░ 0% | 미시작 |
| 배달의민족 | ░░░░░░░░░░ 0% | 미시작 |
`;
}

function renderDailyLog({ date, dayNumber, topic, questions, userAnswer, feedback, modelAnswers, xpGained, newBadges }) {
  const answerBlock = userAnswer
    ? `## 💬 내 답변\n\n${userAnswer}`
    : `## 💬 내 답변\n\n_(답변 없음)_`;

  const feedbackBlock = feedback
    ? `## 🤖 AI 피드백\n\n${feedback}`
    : `## 🤖 AI 피드백\n\n_(피드백 없음)_`;

  const badgeBlock = newBadges.length > 0
    ? `\n---\n\n## 🏅 새로 획득한 뱃지\n\n${newBadges.join(' · ')}\n`
    : '';

  const questionsSection = questions
    .map((q, i) => `### ${i + 1}. ${q.typeLabel}\n\n${q.question}`)
    .join('\n\n');

  const answersSection = questions
    .map((q, i) => `### ${i + 1}. ${q.typeLabel}\n\n${modelAnswers[i]}`)
    .join('\n\n---\n\n');

  return `# ${date} (Day ${dayNumber})

## 📌 오늘의 학습

| 항목 | 내용 |
|------|------|
| **토픽** | ${topic} |
| **문제 수** | 3문제 (개념 / 문제 / 면접) |
| **획득 XP** | +${xpGained} XP |

---

## ❓ 질문 (3문제)

${questionsSection}

---

${answerBlock}

---

${feedbackBlock}

---

## 📚 모범 답안 & 개념 정리

${answersSection}
${badgeBlock}`;
}

// ── README 렌더링 ─────────────────────────────────────────────────────────────

function progressBar(current, max, len = 20) {
  const filled = Math.round((current / max) * len);
  return '█'.repeat(Math.min(filled, len)) + '░'.repeat(Math.max(len - filled, 0));
}

function renderReadme(profile, recentLogs = []) {
  const lv = calcLevel(profile.totalXP, LEVEL_XP);
  const nextXP = LEVEL_XP[lv] ?? profile.totalXP;
  const prevXP = LEVEL_XP[lv - 1] ?? 0;
  const lvProgress = nextXP === profile.totalXP
    ? progressBar(1, 1)
    : progressBar(profile.totalXP - prevXP, nextXP - prevXP);

  const skillRows = Object.entries(SKILL_NAMES).map(([k, name]) => {
    const xp = profile.skills[k] || 0;
    const slv = calcLevel(xp, SKILL_XP);
    const next = SKILL_XP[slv] ?? xp;
    const prev = SKILL_XP[slv - 1] ?? 0;
    const bar = next === xp ? progressBar(1, 1) : progressBar(xp - prev, next - prev);
    return `| ${name} | Lv.${slv} | \`${bar}\` |`;
  }).join('\n');

  const badgeSection = profile.badges.length > 0
    ? profile.badges.join(' · ')
    : '_아직 없음 — 첫 퀘스트를 완료해 뱃지를 획득하세요!_';

  const recentSection = recentLogs.length > 0
    ? recentLogs.map(l => `| ${l.date} | ${l.topic} | +${l.xp} XP |`).join('\n')
    : '| - | - | - |';

  const streakFire = profile.streak >= 7 ? '🔥🔥' : profile.streak >= 3 ? '🔥' : '';

  return `# 📚 Daily Study

매일 목표 회사들의 기술 스택을 분석하고, AI 기반 질문으로 복습하며 백엔드 역량을 키우는 학습 기록입니다.

---

## 🎮 학습 현황

> **Lv.${lv}** 백엔드 개발자 지망생 ${lv >= 5 ? '🚀' : ''}

| 총 XP | 연속 학습 | 완료 퀘스트 |
|-------|-----------|------------|
| **${profile.totalXP}** / ${nextXP} XP | **${profile.streak}일** ${streakFire} | **${profile.questsCompleted}개** |

**레벨 진행도** \`${lvProgress}\` ${profile.totalXP - prevXP} / ${nextXP - prevXP} XP

---

## ⚡ 스킬 레벨

| 스킬 | 레벨 | 진행도 |
|------|------|--------|
${skillRows}

---

## 🏅 획득 뱃지

${badgeSection}

---

## 📅 최근 학습 기록

| 날짜 | 토픽 | 획득 XP |
|------|------|---------|
${recentSection}

---

## 🏢 목표 회사 분석

- 오늘의집 (버킷플레이스)
- 무신사
- 컬리
- 올리브영
- 배달의민족

> 회사별 상세 기술 스택 분석 → [\`companies/\`](./companies/)

---

## 📂 구조

\`\`\`
daily-study/
├── companies/        # 목표 회사별 기술 스택 분석
│   └── [회사명]/
│       ├── overview.md      # 회사 개요 & 채용 요건
│       ├── tech-stack.md    # 기술 스택 정리
│       └── study-notes.md   # 학습 내용 메모
├── daily-log/        # 날짜별 학습 일지 (질문 · 답변 · 피드백 · 모범답안)
├── portfolio/        # 프로젝트 포트폴리오 문서
├── profile.json      # 통계 원본 (봇이 자동 관리)
└── profile.md        # 상세 프로필
\`\`\`

## 진행 방식

1. 저녁 — Slack에 \`!학습 [오늘 배운 내용]\` 입력 → 내일 아침 관련 토픽 질문 발송
2. 08:00 — AI가 개념/문제/면접 3문제 발송 (레벨에 맞는 난이도)
3. 낮 — 채널에 답변 입력 → 즉시 피드백 + 정확도 채점 (0~100점)
4. 13:00 — 모범 답안 공개 + XP 적립 + 학습 기록 GitHub 자동 커밋

> 이 README는 [daily-study-bot](https://github.com/kimdonghuyn/daily-study-bot)이 매일 자동으로 업데이트합니다.
`;
}

// ── GitHub 프로필 README 렌더링 ────────────────────────────────────────────────

function renderGitHubProfile(profile) {
  const lv = calcLevel(profile.totalXP, LEVEL_XP);
  const nextXP = LEVEL_XP[lv] ?? profile.totalXP;
  const prevXP = LEVEL_XP[lv - 1] ?? 0;
  const streakFire = profile.streak >= 7 ? '🔥🔥' : profile.streak >= 3 ? '🔥' : '';
  const badgeStr = profile.badges.length > 0 ? profile.badges.join(' · ') : '없음';
  const updatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  const filled = typeof nextXP === 'number'
    ? Math.round(((profile.totalXP - prevXP) / (nextXP - prevXP)) * 20)
    : 20;
  const bar = '█'.repeat(Math.min(filled, 20)) + '░'.repeat(Math.max(20 - filled, 0));

  const recentSection = (profile.recentLogs || []).slice(0, 5)
    .map(l => `| ${l.date} | ${l.topic} | +${l.xp} XP |`)
    .join('\n') || '| - | - | - |';

  return `# 안녕하세요, 김동현입니다 👋

백엔드 개발자를 목표로 매일 AI 기술 질문에 답변하며 성장하고 있습니다.

---

## 🎮 Daily Study 현황

> 매일 08:00 AI가 백엔드 기술 질문 3문제를 발송 → 답변 → 정확도 채점 → XP 적립

| | |
|---|---|
| **레벨** | Lv.${lv} |
| **총 XP** | ${profile.totalXP} / ${nextXP} |
| **연속 학습** | ${profile.streak}일 ${streakFire} |
| **누적 학습일** | ${profile.dayNumber || 0}일 |
| **완료 퀘스트** | ${profile.questsCompleted}개 |

**레벨 진행도**
\`${bar}\`

🏅 **획득 뱃지** ${badgeStr}

---

## 📅 최근 학습

| 날짜 | 토픽 | 획득 XP |
|------|------|---------|
${recentSection}

---

## 🛠 기술 스택

**Backend** · Java · Spring Boot · JPA · MySQL · Redis · Kafka

**Infra** · Docker · AWS · GitHub Actions

---

> 🤖 이 프로필은 [daily-study-bot](https://github.com/kimdonghuyn/daily-study-bot)이 매일 자동으로 업데이트합니다. (마지막: ${updatedAt})
`;
}

async function updateGitHubProfile(profile) {
  const profileRepo = 'kimdonghuyn';
  const apiUrl = `https://api.github.com/repos/${profileRepo}/${profileRepo}/contents/README.md`;
  const headers = {
    Authorization: `Bearer ${process.env.STUDY_GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'daily-study-bot',
  };

  let sha;
  const existing = await fetch(apiUrl, { headers });
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  }

  const body = {
    message: `profile: 학습 현황 업데이트 (Lv.${calcLevel(profile.totalXP, LEVEL_XP)} | ${profile.totalXP} XP)`,
    content: Buffer.from(renderGitHubProfile(profile), 'utf-8').toString('base64'),
    committer: { name: 'Daily Study Bot', email: 'bot@daily-study-bot.app' },
  };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    console.warn(`GitHub 프로필 업데이트 실패: ${res.status}`);
  } else {
    console.log('✅ GitHub 프로필 README 업데이트 완료');
  }
}

// ── 포트폴리오 문서 렌더링 ──────────────────────────────────────────────────────

function renderPortfolio(profile) {
  const lv = calcLevel(profile.totalXP, LEVEL_XP);
  const totalDays = profile.dayNumber || 0;
  const updatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  return `# Daily Study Bot — 포트폴리오

> 마지막 업데이트: ${updatedAt} | 누적 학습일: ${totalDays}일 | 현재 레벨: Lv.${lv} (${profile.totalXP} XP)

백엔드 개발자 취업 준비를 위한 **자동 학습 Slack 봇**.
매일 AI가 기술 질문 3문제를 생성·발송하고, 답변의 정확도를 0~100점으로 채점해 XP를 부여합니다.

---

## 문제 정의

> "매일 학습 계획을 세워도 작심삼일. 실행을 자동화하지 않으면 꾸준함을 유지할 수 없다."

- 백엔드 개념은 방대해 혼자 범위를 정하기 어려움
- 배운 내용을 다음 날 복습하지 않으면 빠르게 휘발됨
- 면접 대비를 위한 구조화된 질문·피드백 루프가 없음

---

## 시스템 흐름

\`\`\`
[저녁] Slack: "!학습 오늘 Spring AOP 공부했어"
  └─ Claude API: 토픽 자동 매핑 → 내일 아침 토픽 Redis 저장

[08:00 KST] GitHub Actions
  └─ profile.json에서 현재 레벨 조회
  └─ Redis에서 사용자 지정 토픽 확인 (없으면 랜덤)
  └─ Claude API: 개념/문제/면접 3문제 병렬 생성 (800 tokens each)
  └─ Slack: 토픽 요약 + 질문 3개 개별 메시지 발송

[낮] Slack: 사용자 답변 입력
  └─ Vercel Edge Function: Slack 서명 검증 (Web Crypto API)
  └─ Claude API: 0~100점 채점 + 피드백 생성 (JSON 구조화 응답)
  └─ Slack: 스레드에 피드백 + 점수 표시
  └─ Redis: 점수·피드백 저장

[13:00 KST] GitHub Actions
  └─ Claude API: 모범 답안 3개 병렬 생성
  └─ Slack: 모범 답안 3개 개별 메시지 발송
  └─ XP 계산: baseXP(40) × (score / 100), 최소 5XP
  └─ GitHub: daily-study-bot/logs/ 커밋
  └─ GitHub: daily-study/ profile.json·README·daily-log·portfolio 자동 업데이트
\`\`\`

---

## 핵심 기술 결정

### 1. Vercel Edge Runtime 선택 — Slack 서명 검증

Slack 웹훅 서명 검증은 파싱 전 **raw body**가 필요. Vercel Node.js Runtime에서는 body가 이미 소진된 상태로 전달돼 raw body 재현 불가. Edge Runtime의 \`request.text()\`로 해결. Node.js \`crypto\` 대신 Web Crypto API(\`crypto.subtle\`) 사용.

### 2. AI 응답 구조화 — JSON 채점

피드백과 점수를 하나의 API 호출로 동시에 얻기 위해 AI에게 순수 JSON으로만 응답하도록 프롬프트 설계. 파싱 실패 시 regex로 JSON 블록 추출, 최종 실패 시 기본값(50점) fallback.

\`\`\`js
const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
const parsed = JSON.parse(jsonMatch[0]);
return { score: Number(parsed.score), feedback: String(parsed.feedback) };
\`\`\`

### 3. 3문제 병렬 생성 — Promise.all

개념/문제/면접 3문제를 순차 생성하면 ~6초. \`Promise.all\`로 병렬화해 ~2초로 단축. 각 질문은 독립적이라 병렬화 부작용 없음.

### 4. Slack 메시지 분리 발송 — 블록 한도 회피

3문제를 하나의 Slack 메시지에 담으면 블록 페이로드 한도를 초과해 내용이 잘림. 토픽 요약 헤더 1개 + 질문별 개별 메시지 3개로 분리해 해결.

### 5. 레벨 기반 난이도 자동 조절

morning.js가 \`daily-study/profile.json\`에서 현재 XP를 읽어 레벨 계산 후 프롬프트에 난이도 가이드 삽입. 코드 변경 없이 학습자의 성장에 맞게 질문 수준이 자동으로 올라감.

### 6. 타겟 회사 맥락 시나리오

문제 상황 질문에 오늘의집·무신사·컬리·올리브영·배달의민족 5개사의 서비스 특성을 프롬프트에 명시. AI가 토픽과 가장 잘 어울리는 회사를 선택해 현실감 있는 장애 시나리오 생성.

### 7. 크로스 레포 연동 — PAT 분리

\`daily-study-bot\` 레포는 \`GITHUB_TOKEN\`(자동 발급), \`daily-study\` 레포는 별도 PAT(\`STUDY_GITHUB_TOKEN\`) 사용. 두 레포의 write 권한을 최소 범위로 분리.

---

## 트러블슈팅 요약

| # | 문제 | 원인 | 해결 |
|---|------|------|------|
| 1 | Slack 서명 검증 401 | Vercel Node.js Runtime에서 body 스트림 소진 | Edge Runtime + \`request.text()\` 전환 |
| 2 | Redis JSON 이중 파싱 오류 | \`@upstash/redis\` 자동 역직렬화 | \`typeof data === 'string'\` 타입 가드 |
| 3 | Slack 메시지 3000자 잘림 | Block Kit section 3000자 제한 | \`splitTextBlocks()\` 2900자 분할 헬퍼 |
| 4 | 3문제 메시지 페이로드 잘림 | 단일 메시지 블록 총량 한도 초과 | 질문별 개별 메시지 분리 발송 |
| 5 | UTC/KST 날짜 불일치 | \`new Date().toISOString()\`이 UTC 기준 | KST 오프셋 +9h 적용 통일 |
| 6 | 이벤트 미수신 | OAuth 스코프 변경 후 앱 재설치 누락 | Slack 앱 Reinstall to Workspace |
| 7 | AI 엔진 품질 이슈 | 무료 엔진(Gemini, Groq) 피드백 정확도 부족 | Claude Haiku 4.5로 회귀 |

---

## 기술 스택

| 분류 | 기술 | 선택 이유 |
|------|------|----------|
| Runtime | Node.js 20 (ES Modules) | GitHub Actions 기본 환경 |
| AI | Claude API (claude-haiku-4-5) | 피드백 정확도 + 비용 균형 |
| Hosting | Vercel Edge Functions | raw body 접근 + 저지연 |
| Scheduler | GitHub Actions cron | 별도 서버 불필요 |
| Storage | Upstash Redis (REST) | Edge Runtime에서 HTTP로 접근 가능 |
| Messaging | Slack Web API + Events API | |

---

## 학습 현황 (자동 갱신)

| 항목 | 값 |
|------|-----|
| 누적 학습일 | ${totalDays}일 |
| 현재 레벨 | Lv.${lv} |
| 총 XP | ${profile.totalXP} |
| 연속 학습 | ${profile.streak}일 |
| 완료 퀘스트 | ${profile.questsCompleted}개 |
| 획득 뱃지 | ${profile.badges.length > 0 ? profile.badges.join(' · ') : '없음'} |

> 이 문서는 [daily-study-bot](https://github.com/kimdonghuyn/daily-study-bot)이 매일 13:00 KST에 자동으로 업데이트합니다.
`;
}

// ── 메인 export ───────────────────────────────────────────────────────────────

export async function updateStudyProfile({ date, topic, questions, userAnswer, feedback, modelAnswers, answerScore }) {
  // 현재 프로필 읽기
  const profileFile = await getFile('profile.json');
  const profile = profileFile ? JSON.parse(profileFile.content) : { ...DEFAULT_PROFILE };

  // XP 계산 — 3문제 합산 * 정확도
  // 답변 있으면: baseXP(40) × (score/100), 최소 5XP / 답변 없으면: 5XP
  const baseXP = questions.reduce((sum, q) => sum + (TYPE_XP[q.type] || 10), 0);
  const xpGained = userAnswer
    ? Math.max(5, Math.round(baseXP * (answerScore != null ? answerScore / 100 : 0.5)))
    : 5;

  // 스트릭 & 보너스
  const newStreak = calcStreak(profile.lastStudyDate, profile.streak, date);
  let streakBonus = 0;
  if (newStreak === 3) streakBonus = 10;
  else if (newStreak === 7) streakBonus = 30;
  else if (newStreak === 30) streakBonus = 100;

  const totalXP = xpGained + streakBonus;

  // 프로필 업데이트
  const skill = TOPIC_SKILL[topic] || 'cs';
  profile.totalXP += totalXP;
  profile.skills[skill] = (profile.skills[skill] || 0) + xpGained;
  profile.streak = newStreak;
  profile.lastStudyDate = date;
  profile.questsCompleted += questions.length;
  profile.dayNumber = (profile.dayNumber || 0) + 1;

  // 뱃지 체크
  const newBadges = checkBadges(profile);
  profile.badges = [...profile.badges, ...newBadges];

  // 최근 학습 기록 (README용) — 최대 7개 유지
  if (!profile.recentLogs) profile.recentLogs = [];
  profile.recentLogs.unshift({ date, topic, xp: totalXP });
  if (profile.recentLogs.length > 7) profile.recentLogs = profile.recentLogs.slice(0, 7);

  // profile.json 커밋
  await putFile('profile.json', JSON.stringify(profile, null, 2),
    `study: ${date} 프로필 업데이트 (+${totalXP} XP)`, profileFile?.sha);

  // profile.md 재생성
  const profileMd = await getFile('profile.md');
  await putFile('profile.md', renderProfileMd(profile),
    `study: ${date} 프로필 렌더링`, profileMd?.sha);

  // README.md 업데이트
  const readmeFile = await getFile('README.md');
  await putFile('README.md', renderReadme(profile, profile.recentLogs),
    `study: ${date} README 진행도 업데이트`, readmeFile?.sha);

  // daily-log 생성
  const logPath = `daily-log/${date}.md`;
  const logFile = await getFile(logPath);
  await putFile(logPath, renderDailyLog({
    date, dayNumber: profile.dayNumber, topic, questions,
    userAnswer, feedback, modelAnswers, xpGained: totalXP, newBadges,
  }), `study: ${date} 학습 일지`, logFile?.sha);

  // Redis 프로필 캐시 갱신 (!상태 커맨드용)
  await cacheProfile(profile);

  // portfolio 문서 자동 업데이트
  const portfolioPath = 'portfolio/daily-study-bot.md';
  const portfolioFile = await getFile(portfolioPath);
  await putFile(portfolioPath, renderPortfolio(profile),
    `portfolio: ${date} 기능·현황 업데이트`, portfolioFile?.sha);

  // GitHub 프로필 페이지 업데이트 (kimdonghuyn/kimdonghuyn)
  await updateGitHubProfile(profile);

  const badgeMsg = newBadges.length > 0 ? ` | 새 뱃지: ${newBadges.join(' ')}` : '';
  console.log(`✅ daily-study 업데이트 완료: +${totalXP} XP | 스트릭 ${newStreak}일${badgeMsg}`);
}

// ── /학습 커맨드 (Claude Code 세션) ───────────────────────────────────────────

const TYPE_LABELS_LOCAL = { concept: '📖 개념 설명', problem: '🔧 문제 상황', interview: '🎤 면접 질문' };

function renderStudySessionLog({ date, dayNumber, topic, type, summary, xpGained, newBadges }) {
  const badgeBlock = newBadges.length > 0
    ? `\n---\n\n## 🏅 새로 획득한 뱃지\n\n${newBadges.join(' · ')}\n`
    : '';

  return `# ${date} 학습 세션 (Day ${dayNumber})

## 📌 오늘의 학습

| 항목 | 내용 |
|------|------|
| **토픽** | ${topic} |
| **유형** | ${TYPE_LABELS_LOCAL[type] || type} |
| **방식** | Claude Code 자기주도 학습 |
| **획득 XP** | +${xpGained} XP |

---

## 📝 학습 요약

${summary}
${badgeBlock}`;
}

export async function updateStudyProfileFromSession({ date, topic, type, summary }) {
  const profileFile = await getFile('profile.json');
  const profile = profileFile ? JSON.parse(profileFile.content) : { ...DEFAULT_PROFILE };

  const xpGained = TYPE_XP[type] || 10;
  const alreadyToday = profile.lastStudyDate === date;

  // 같은 날 Slack Q&A와 중복 시: XP만 추가, dayNumber/questsCompleted는 건드리지 않음
  const newStreak = alreadyToday ? profile.streak : calcStreak(profile.lastStudyDate, profile.streak, date);
  let streakBonus = 0;
  if (!alreadyToday) {
    if (newStreak === 3) streakBonus = 10;
    else if (newStreak === 7) streakBonus = 30;
    else if (newStreak === 30) streakBonus = 100;
  }
  const totalXP = xpGained + streakBonus;

  const skill = TOPIC_SKILL[topic] || 'cs';
  profile.totalXP += totalXP;
  profile.skills[skill] = (profile.skills[skill] || 0) + xpGained;
  profile.lastStudyDate = date;
  if (!alreadyToday) {
    profile.streak = newStreak;
    profile.questsCompleted += 1;
    profile.dayNumber = (profile.dayNumber || 0) + 1;
  }

  const newBadges = checkBadges(profile);
  profile.badges = [...profile.badges, ...newBadges];

  if (!profile.recentLogs) profile.recentLogs = [];
  profile.recentLogs.unshift({ date, topic, xp: totalXP });
  if (profile.recentLogs.length > 7) profile.recentLogs = profile.recentLogs.slice(0, 7);

  await putFile('profile.json', JSON.stringify(profile, null, 2),
    `study: ${date} 프로필 업데이트 (+${totalXP} XP)`, profileFile?.sha);

  const profileMd = await getFile('profile.md');
  await putFile('profile.md', renderProfileMd(profile),
    `study: ${date} 프로필 렌더링`, profileMd?.sha);

  const readmeFile = await getFile('README.md');
  await putFile('README.md', renderReadme(profile, profile.recentLogs),
    `study: ${date} README 진행도 업데이트`, readmeFile?.sha);

  const logPath = `daily-log/${date}.md`;
  const logFile = await getFile(logPath);
  await putFile(logPath, renderStudySessionLog({
    date, dayNumber: profile.dayNumber, topic, type, summary, xpGained: totalXP, newBadges,
  }), `study: ${date} 학습 일지`, logFile?.sha);

  await cacheProfile(profile);
  await updateGitHubProfile(profile);

  const badgeMsg = newBadges.length > 0 ? ` | 새 뱃지: ${newBadges.join(' ')}` : '';
  console.log(`✅ 프로필 업데이트: +${totalXP} XP | Lv.${calcLevel(profile.totalXP, LEVEL_XP)} | 스트릭 ${newStreak}일${badgeMsg}`);
}
