// 오늘 학습 완료 처리 — XP 적립 + 진도율 업데이트
import { generateStudySummary } from '../lib/claude.js';
import { TOPIC_POOL, TYPE_SEQUENCE, CYCLE_LENGTH } from '../lib/topics.js';
import { saveStudySummary } from '../lib/redis.js';
import { updateStudyProfileFromSession } from '../lib/studyProfile.js';

const OWNER = 'kimdonghuyn';

async function fetchProfile() {
  const token = process.env.STUDY_GITHUB_TOKEN;
  if (!token) return { dayNumber: 0 };
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/daily-study/contents/profile.json?ref=master`,
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
  const { dayNumber } = await fetchProfile();
  const cycle = Math.floor(dayNumber / CYCLE_LENGTH);
  const type = TYPE_SEQUENCE[dayNumber % 3];
  const topic = TOPIC_POOL[Math.floor(dayNumber / 3) % TOPIC_POOL.length];
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log('\n' + '═'.repeat(52));
  console.log(`  ✅ 학습 완료 처리 중...`);
  console.log(`  📌 ${topic}`);
  console.log('─'.repeat(52));

  console.log('  학습 요약 생성 중...');
  const summary = await generateStudySummary(`${topic} 자기주도 학습`, topic);

  // 내일 아침 recap용 Redis 저장
  await saveStudySummary(summary);

  // GitHub 프로필 XP + 진도율 + 일지 업데이트
  await updateStudyProfileFromSession({ date: today, topic, type, summary });

  console.log('\n' + '═'.repeat(52));
  console.log('  🎉 완료! XP 및 커리큘럼 진도율이 업데이트됐습니다.');
  console.log('  📊 daily-study 레포에서 진행 현황을 확인하세요.');
  console.log('═'.repeat(52) + '\n');
  console.log(summary);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
