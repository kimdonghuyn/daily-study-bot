// 오늘의 학습 가이드 출력 — 주제·목표·설명을 Claude가 생성
import { generateStudyGuide } from '../lib/claude.js';
import { TOPIC_POOL, TYPE_SEQUENCE, CYCLE_LENGTH } from '../lib/topics.js';

const OWNER = 'kimdonghuyn';
const TYPE_LABELS_KR = { concept: '📖 개념 설명', problem: '🔧 문제 상황', interview: '🎤 면접 질문' };

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
  const cycleLabel = cycle === 0 ? '신입' : cycle === 1 ? '주니어' : '중급+';

  console.log('\n' + '═'.repeat(52));
  console.log(`  📚 오늘의 학습  |  Day ${dayNumber + 1}  |  Cycle ${cycle} (${cycleLabel})`);
  console.log('═'.repeat(52));
  console.log(`  토픽: ${topic}`);
  console.log(`  유형: ${TYPE_LABELS_KR[type]}`);
  console.log('─'.repeat(52));
  console.log('  학습 가이드 생성 중...\n');

  const guide = await generateStudyGuide(topic, type, cycle);

  console.log(guide);

  console.log('\n' + '═'.repeat(52));
  console.log('  💬 이해 안 되는 부분은 Claude Code에 질문하세요!');
  console.log('  ✅ 다 이해했으면: ./run-study-done.sh');
  console.log('═'.repeat(52) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
