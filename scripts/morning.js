// 매일 08:00 KST 실행 — 오늘의 질문 생성 및 Slack 발송
import { generateDailyQuestion, TOPIC_POOL, TYPE_SEQUENCE, CYCLE_LENGTH } from '../lib/claude.js';
import { saveQuestion, saveQuestionTs, getTopicRequest, getYesterdayStudySummary } from '../lib/redis.js';
import { postQuestions } from '../lib/slack.js';

async function fetchProfile() {
  const token = process.env.STUDY_GITHUB_TOKEN;
  if (!token) return { dayNumber: 0 };

  try {
    const res = await fetch(
      'https://api.github.com/repos/kimdonghuyn/daily-study/contents/profile.json?ref=master',
      { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'daily-study-bot' } }
    );
    if (!res.ok) return { dayNumber: 0 };

    const data = await res.json();
    const profile = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    return { dayNumber: profile.dayNumber || 0 };
  } catch {
    return { dayNumber: 0 };
  }
}

async function main() {
  console.log('🌅 Morning job 시작...');

  const { dayNumber } = await fetchProfile();
  const cycle = Math.floor(dayNumber / CYCLE_LENGTH);
  const type = TYPE_SEQUENCE[dayNumber % 3];

  const topicRequest = await getTopicRequest();
  const roadmapTopic = TOPIC_POOL[Math.floor(dayNumber / 3) % TOPIC_POOL.length];
  const topic = topicRequest ? topicRequest.trim() : roadmapTopic;

  console.log(`토픽: ${topic} (${topicRequest ? '!학습 지정' : '로드맵 순서'}) | 유형: ${type} | 사이클: ${cycle}`);

  const recap = await getYesterdayStudySummary();
  const questions = await generateDailyQuestion(topic, type, cycle);
  await saveQuestion(questions);
  const questionTs = await postQuestions(questions, recap);
  if (questionTs) await saveQuestionTs(questionTs);

  console.log('✅ 질문 발송 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
