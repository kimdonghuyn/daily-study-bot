// 매일 13:00 KST 실행 — 모범 답안 생성, Slack 발송, GitHub 학습 기록 커밋
import { generateModelAnswer } from '../lib/claude.js';
import { getQuestion, getUserAnswer, getFeedback } from '../lib/redis.js';
import { postModelAnswer } from '../lib/slack.js';
import { commitDailyLog, formatDailyLog } from '../lib/github.js';
import { updateStudyProfile } from '../lib/studyProfile.js';

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

  // GitHub에 오늘의 학습 기록 커밋
  const today = new Date().toISOString().split('T')[0];
  const userAnswer = await getUserAnswer();
  const feedback = await getFeedback();

  const content = formatDailyLog({
    date: today,
    topic: data.topic,
    typeLabel: data.typeLabel,
    question: data.question,
    userAnswer,
    feedback,
    modelAnswer: answer,
  });

  await commitDailyLog(today, content);

  // daily-study 레포 XP/뱃지/README 자동 업데이트
  await updateStudyProfile({
    date: today,
    topic: data.topic,
    type: data.type,
    typeLabel: data.typeLabel,
    question: data.question,
    userAnswer,
    feedback,
    modelAnswer: answer,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
