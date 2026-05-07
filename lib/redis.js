import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function todayKey(suffix) {
  // UTC+9 (KST) 기준 날짜 — 모닝(23:00 UTC)과 오후(04:00 UTC)가 같은 날짜를 공유
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().split('T')[0];
  return `daily-study:${today}:${suffix}`;
}

export async function saveQuestion(data) {
  await redis.set(todayKey('question'), JSON.stringify(data), { ex: 60 * 60 * 24 * 2 }); // 2일 보관
}

export async function getQuestion() {
  const data = await redis.get(todayKey('question'));
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function saveUserAnswer(answer) {
  await redis.set(todayKey('answer'), answer, { ex: 60 * 60 * 24 * 2 });
}

export async function getUserAnswer() {
  return await redis.get(todayKey('answer'));
}

export async function saveFeedback(feedback) {
  await redis.set(todayKey('feedback'), feedback, { ex: 60 * 60 * 24 * 2 });
}

export async function getFeedback() {
  return await redis.get(todayKey('feedback'));
}
