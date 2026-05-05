import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function todayKey(suffix) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `daily-study:${today}:${suffix}`;
}

export async function saveQuestion(data) {
  await redis.set(todayKey('question'), JSON.stringify(data), { ex: 60 * 60 * 24 * 2 }); // 2일 보관
}

export async function getQuestion() {
  const data = await redis.get(todayKey('question'));
  return data ? JSON.parse(data) : null;
}

export async function saveUserAnswer(answer) {
  await redis.set(todayKey('answer'), answer, { ex: 60 * 60 * 24 * 2 });
}

export async function getUserAnswer() {
  return await redis.get(todayKey('answer'));
}
