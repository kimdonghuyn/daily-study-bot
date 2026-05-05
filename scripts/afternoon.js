// 매일 13:00 KST 실행 — 모범 답안 생성 및 Slack 발송
import { generateModelAnswer } from '../lib/claude.js';
import { getQuestion } from '../lib/redis.js';
import { postModelAnswer } from '../lib/slack.js';

async function main() {
  console.log('📚 Afternoon job 시작...');

  const data = await getQuestion();
  if (!data) {
    console.error('오늘의 질문을 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`토픽: ${data.topic}`);

  const answer = await generateModelAnswer(data.question, data.topic);
  await postModelAnswer({ ...data, answer });

  console.log('✅ 모범 답안 발송 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
