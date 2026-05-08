// 매일 08:00 KST 실행 — 오늘의 질문 생성 및 Slack 발송
import { generateDailyQuestion, TOPIC_POOL, TYPE_SEQUENCE } from '../lib/claude.js';
import { saveQuestion, getTopicRequest, getYesterdayStudySummary } from '../lib/redis.js';
import { postQuestions } from '../lib/slack.js';

const LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500];

async function fetchProfile() {
  const token = process.env.STUDY_GITHUB_TOKEN;
  if (!token) return { level: 1, dayNumber: 0 };

  try {
    const res = await fetch(
      'https://api.github.com/repos/kimdonghuyn/daily-study/contents/profile.json?ref=master',
      { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'daily-study-bot' } }
    );
    if (!res.ok) return { level: 1, dayNumber: 0 };

    const data = await res.json();
    const profile = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));

    let level = 1;
    for (let i = 0; i < LEVEL_XP.length; i++) {
      if (profile.totalXP >= LEVEL_XP[i]) level = i + 1;
      else break;
    }
    return { level, dayNumber: profile.dayNumber || 0 };
  } catch {
    return { level: 1, dayNumber: 0 };
  }
}

async function main() {
  console.log('🌅 Morning job 시작...');

  const { level, dayNumber } = await fetchProfile();
  const type = TYPE_SEQUENCE[dayNumber % 3];

  const topicRequest = await getTopicRequest();
  const roadmapTopic = TOPIC_POOL[Math.floor(dayNumber / 3) % TOPIC_POOL.length];
  const topic = topicRequest ? topicRequest.trim() : roadmapTopic;

  console.log(`토픽: ${topic} (${topicRequest ? '/학습 기록' : '로드맵 순서'}) | 유형: ${type} | 레벨: Lv.${level}`);

  const recap = await getYesterdayStudySummary();
  const questions = await generateDailyQuestion(topic, type, level);
  await saveQuestion(questions);
  await postQuestions(questions, recap);

  console.log('✅ 질문 발송 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
