// 매일 13:00 KST 실행 — 모범 답안 생성, Slack 발송, GitHub 학습 기록 커밋
import { generateModelAnswer } from '../lib/claude.js';
import { getQuestion, getUserAnswer, getFeedback, getAnswerScore } from '../lib/redis.js';
import { postModelAnswer } from '../lib/slack.js';
import { commitDailyLog, formatDailyLog } from '../lib/github.js';
import { updateStudyProfile } from '../lib/studyProfile.js';

async function main() {
  console.log('📚 Afternoon job 시작...');

  const questions = await getQuestion();
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    console.error('오늘의 질문을 찾을 수 없습니다.');
    process.exit(1);
  }

  const topic = questions[0].topic;
  console.log(`토픽: ${topic}`);

  const modelAnswers = await generateModelAnswer(questions, topic);
  await postModelAnswer({ topic, questions, modelAnswers });
  console.log('✅ 모범 답안 발송 완료');

  // KST 기준 날짜
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  const userAnswer = await getUserAnswer();
  const feedback = await getFeedback();
  const answerScore = await getAnswerScore();

  const content = formatDailyLog({
    date: today,
    topic,
    questions,
    userAnswer,
    feedback,
    modelAnswers,
  });

  await commitDailyLog(today, content);

  await updateStudyProfile({
    date: today,
    topic,
    questions,
    userAnswer,
    feedback,
    modelAnswers,
    answerScore,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
