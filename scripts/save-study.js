// /학습 커맨드 종료 후 호출 — Redis 저장 + GitHub XP/프로필 업데이트
// Usage: node scripts/save-study.js "토픽명" "type" < /tmp/study-summary.txt
import { saveStudySummary, saveTopicRequest } from '../lib/redis.js';
import { updateStudyProfileFromSession } from '../lib/studyProfile.js';
import { readFileSync } from 'fs';

const topic = process.argv[2];
const type = process.argv[3] || 'concept';

if (!topic) {
  console.error('Usage: node scripts/save-study.js "토픽명" "type" < summary.txt');
  process.exit(1);
}

const summary = readFileSync('/dev/stdin', 'utf-8').trim();
if (!summary) {
  console.error('요약 내용이 없습니다. stdin으로 전달하세요.');
  process.exit(1);
}

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

// 1. Redis 저장 (내일 아침 봇이 읽음)
await saveTopicRequest(topic);
await saveStudySummary(summary);

// 2. GitHub XP + 프로필 + 학습 일지 업데이트
await updateStudyProfileFromSession({ date: today, topic, type, summary });

console.log(`\n📥 저장 완료!`);
console.log(`   토픽: ${topic} | 내일 아침 Slack에서 이 토픽으로 질문이 발송됩니다.`);
