// 학습 이력 전체 초기화 — profile.json 리셋 + logs/ 전체 삭제
const BOT_REPO = 'kimdonghuyn/daily-study-bot';
const STUDY_REPO = 'kimdonghuyn/daily-study';
const TOKEN = process.env.STUDY_GITHUB_TOKEN;
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'daily-study-bot', 'Content-Type': 'application/json' };

async function ghGet(path) {
  const res = await fetch(`https://api.github.com/repos/${path}`, { headers: HEADERS });
  return res.ok ? res.json() : null;
}

async function ghDelete(repo, path, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: HEADERS,
    body: JSON.stringify({ message, sha, committer: { name: 'Daily Study Bot', email: 'bot@daily-study-bot.app' } }),
  });
  return res.ok;
}

async function ghPut(repo, path, content, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2), 'utf-8').toString('base64'),
    committer: { name: 'Daily Study Bot', email: 'bot@daily-study-bot.app' },
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT', headers: HEADERS, body: JSON.stringify(body),
  });
  return res.ok;
}

async function main() {
  console.log('🗑️  logs/ 파일 삭제 중...');
  const logs = await ghGet(`${BOT_REPO}/contents/logs?ref=main`);
  if (Array.isArray(logs)) {
    for (const file of logs) {
      const ok = await ghDelete(BOT_REPO, file.path, file.sha, `reset: ${file.name} 삭제`);
      console.log(`  ${ok ? '✅' : '❌'} ${file.name}`);
    }
  }

  console.log('\n🔄 profile.json 초기화 중...');
  const profileFile = await ghGet(`${STUDY_REPO}/contents/profile.json?ref=master`);
  const defaultProfile = {
    totalXP: 0,
    streak: 0,
    dayNumber: 0,
    lastStudyDate: null,
    questsCompleted: 0,
    skills: { java: 0, spring: 0, db: 0, kafka: 0, msa: 0, aws: 0, cs: 0 },
    badges: [],
    recentLogs: [],
  };
  const ok = await ghPut(STUDY_REPO, 'profile.json', defaultProfile, profileFile?.sha, 'reset: 학습 이력 초기화');
  console.log(`  ${ok ? '✅' : '❌'} profile.json 초기화`);

  console.log('\n✅ 초기화 완료! Day 1부터 다시 시작합니다.');
}

main().catch(err => { console.error(err); process.exit(1); });
