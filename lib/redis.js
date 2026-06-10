import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function todayKey(suffix) {
  // UTC+9 (KST) 기준 날짜
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().split('T')[0];
  return `daily-study:${today}:${suffix}`;
}

function dateKey(date, suffix) {
  return `daily-study:${date}:${suffix}`;
}

// ── 오늘의 질문 ───────────────────────────────────────────────────────────────

export async function saveQuestion(data) {
  await redis.set(todayKey('question'), JSON.stringify(data), { ex: 60 * 60 * 24 * 2 });
}

export async function getQuestion() {
  const data = await redis.get(todayKey('question'));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// 자정 이후 답변 시 어제 질문 fallback용
export async function getQuestionForDate(date) {
  const data = await redis.get(dateKey(date, 'question'));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export function getYesterdayDateKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - 1);
  return kst.toISOString().split('T')[0];
}

// ── 질문 메시지 ts (쓰레드 연결용) ───────────────────────────────────────────

export async function saveQuestionTs(ts) {
  await redis.set(todayKey('question-ts'), String(ts), { ex: 60 * 60 * 24 * 2 });
}

export async function getQuestionTs() {
  return await redis.get(todayKey('question-ts'));
}

// ── 사용자 답변 ───────────────────────────────────────────────────────────────

export async function saveUserAnswer(answer) {
  await redis.set(todayKey('answer'), answer, { ex: 60 * 60 * 24 * 2 });
}

export async function getUserAnswer() {
  return await redis.get(todayKey('answer'));
}

// ── AI 피드백 ─────────────────────────────────────────────────────────────────

export async function saveFeedback(feedback) {
  await redis.set(todayKey('feedback'), feedback, { ex: 60 * 60 * 24 * 2 });
}

export async function getFeedback() {
  return await redis.get(todayKey('feedback'));
}

// ── 답변 점수 (0~100) — 오후 XP 계산에 사용 ───────────────────────────────────

export async function saveAnswerScore(score) {
  await redis.set(todayKey('answer-score'), String(score), { ex: 60 * 60 * 24 * 2 });
}

export async function getAnswerScore() {
  const val = await redis.get(todayKey('answer-score'));
  if (val == null) return null;
  return Number(val);
}

// ── 학습 노트 & 요약 (!학습 커맨드) ──────────────────────────────────────────

export async function saveStudyNote(note) {
  await redis.set(todayKey('study-note'), note, { ex: 60 * 60 * 24 * 2 });
}

export async function getStudyNote() {
  return await redis.get(todayKey('study-note'));
}

export async function saveStudySummary(summary) {
  await redis.set(todayKey('study-summary'), summary, { ex: 60 * 60 * 36 });
}

export async function getYesterdayStudySummary() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - 1);
  const yesterday = kst.toISOString().split('T')[0];
  return await redis.get(`daily-study:${yesterday}:study-summary`);
}

// ── 내일 토픽 요청 (!학습 → 다음 날 아침 반영) ────────────────────────────────

export async function saveTopicRequest(topic) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + 1);
  const tomorrow = kst.toISOString().split('T')[0];
  await redis.set(dateKey(tomorrow, 'topic-request'), topic, { ex: 60 * 60 * 36 });
}

export async function getTopicRequest() {
  return await redis.get(todayKey('topic-request'));
}

// ── 프로필 캐시 (!상태 커맨드용 빠른 조회) ────────────────────────────────────

export async function cacheProfile(profile) {
  await redis.set('daily-study:profile-cache', JSON.stringify(profile));
}

export async function getCachedProfile() {
  const data = await redis.get('daily-study:profile-cache');
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}
