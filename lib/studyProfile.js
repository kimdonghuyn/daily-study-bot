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

function renderDailyLog({ date, dayNumber, topic, typeLabel, question, userAnswer, feedback, modelAnswer, xpGained, newBadges }) {
  const answerBlock = userAnswer
    ? `## 💬 내 답변\n\n${userAnswer}`
    : `## 💬 내 답변\n\n_(답변 없음)_`;

  const feedbackBlock = feedback
    ? `## 🤖 AI 피드백\n\n${feedback}`
    : `## 🤖 AI 피드백\n\n_(피드백 없음)_`;

  const badgeBlock = newBadges.length > 0
    ? `\n---\n\n## 🏅 새로 획득한 뱃지\n\n${newBadges.join(' · ')}\n`
    : '';

  return `# ${date} (Day ${dayNumber})

## 📌 오늘의 학습

| 항목 | 내용 |
|------|------|
| **토픽** | ${topic} |
| **유형** | ${typeLabel} |
| **획득 XP** | +${xpGained} XP |

---

## ❓ 질문

${question}

---

${answerBlock}

---

${feedbackBlock}

---

## 📚 모범 답안 & 개념 정리

${modelAnswer}
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

매일 AI 기반 기술 면접 질문에 답변하고, 피드백과 모범 답안으로 백엔드 역량을 키우는 학습 기록입니다.

---

## 🎮 캐릭터 스탯

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

## 📂 구조

\`\`\`
daily-study/
├── daily-log/        # 날짜별 학습 일지 (질문 · 답변 · 피드백 · 모범답안)
├── companies/        # 목표 회사별 기술 스택 분석
├── quests/           # 퀘스트 풀 · XP 가이드 · 뱃지
├── profile.json      # 통계 원본 (봇이 자동 관리)
└── profile.md        # 상세 프로필

\`\`\`

> 이 README는 [daily-study-bot](https://github.com/kimdonghuyn/daily-study-bot)이 매일 자동으로 업데이트합니다.
`;
}

// ── 메인 export ───────────────────────────────────────────────────────────────

export async function updateStudyProfile({ date, topic, type, typeLabel, question, userAnswer, feedback, modelAnswer }) {
  // 현재 프로필 읽기
  const profileFile = await getFile('profile.json');
  const profile = profileFile ? JSON.parse(profileFile.content) : { ...DEFAULT_PROFILE };

  // XP 계산
  const baseXP = TYPE_XP[type] || 10;
  const xpGained = userAnswer ? baseXP : Math.max(5, baseXP - 5);

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
  profile.questsCompleted += 1;
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
    date, dayNumber: profile.dayNumber, topic, typeLabel,
    question, userAnswer, feedback, modelAnswer, xpGained: totalXP, newBadges,
  }), `study: ${date} 학습 일지`, logFile?.sha);

  const badgeMsg = newBadges.length > 0 ? ` | 새 뱃지: ${newBadges.join(' ')}` : '';
  console.log(`✅ daily-study 업데이트 완료: +${totalXP} XP | 스트릭 ${newStreak}일${badgeMsg}`);
}
