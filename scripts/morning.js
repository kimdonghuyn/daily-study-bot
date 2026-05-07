// 매일 08:00 KST 실행 — 오늘의 질문 생성 및 Slack 발송
import { generateDailyQuestions, pickRandom, TOPIC_POOL } from '../lib/claude.js';
import { saveQuestion, getTopicRequest } from '../lib/redis.js';
import { postQuestions } from '../lib/slack.js';

const LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500];

async function fetchCurrentLevel() {
  const token = process.env.STUDY_GITHUB_TOKEN;
  if (!token) return 1;

  try {
    const res = await fetch(
      'https://api.github.com/repos/kimdonghuyn/daily-study/contents/profile.json?ref=master',
      { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'daily-study-bot' } }
    );
    if (!res.ok) return 1;

    const data = await res.json();
    const profile = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    let level = 1;
    for (let i = 0; i < LEVEL_XP.length; i++) {
      if (profile.totalXP >= LEVEL_XP[i]) level = i + 1;
      else break;
    }
    return level;
  } catch {
    return 1;
  }
}

async function main() {
  console.log('🌅 Morning job 시작...');

  const topicRequest = await getTopicRequest();
  const topic = topicRequest ? topicRequest.trim() : pickRandom(TOPIC_POOL);
  const level = await fetchCurrentLevel();

  console.log(`토픽: ${topic} (${topicRequest ? '사용자 요청' : '랜덤'}) | 레벨: Lv.${level}`);

  const questions = await generateDailyQuestions(topic, level);
  await saveQuestion(questions);
  await postQuestions(questions);

  console.log('✅ 질문 발송 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
