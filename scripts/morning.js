// 매일 08:00 KST 실행 — 오늘의 질문 생성 및 Slack 발송
import { generateQuestion, pickRandom, TOPIC_POOL } from '../lib/claude.js';
import { saveQuestion } from '../lib/redis.js';
import { postQuestion } from '../lib/slack.js';

const TYPES = ['concept', 'problem', 'interview'];

async function main() {
  console.log('🌅 Morning job 시작...');

  const topic = pickRandom(TOPIC_POOL);
  const type  = pickRandom(TYPES);

  console.log(`토픽: ${topic} | 유형: ${type}`);

  const data = await generateQuestion(topic, type);
  await saveQuestion(data);
  await postQuestion(data);

  console.log('✅ 질문 발송 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
