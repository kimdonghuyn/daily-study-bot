const OWNER = 'kimdonghuyn';
const REPO = 'daily-study-bot';

export async function commitDailyLog(date, content) {
  const token = process.env.GITHUB_TOKEN;
  const path = `logs/${date}.md`;
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'daily-study-bot',
  };

  let sha;
  const existing = await fetch(apiUrl, { headers });
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  }

  const body = {
    message: `study: ${date} 학습 기록`,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    committer: { name: 'Daily Study Bot', email: 'bot@daily-study-bot.app' },
  };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub commit 실패: ${res.status} ${err}`);
  }

  console.log(`✅ GitHub 커밋 완료: ${path}`);
}

export function formatDailyLog({ date, topic, questions, userAnswer, feedback, modelAnswers }) {
  const answerSection = userAnswer
    ? `## 💬 나의 답변\n\n${userAnswer}`
    : `## 💬 나의 답변\n\n(답변 없음)`;

  const feedbackSection = feedback
    ? `## 🤖 AI 피드백\n\n${feedback}`
    : `## 🤖 AI 피드백\n\n(피드백 없음)`;

  const questionsSection = questions
    .map((q, i) => `### ${i + 1}. ${q.typeLabel}\n\n${q.question}`)
    .join('\n\n');

  const answersSection = questions
    .map((q, i) => `### ${i + 1}. ${q.typeLabel}\n\n${modelAnswers[i]}`)
    .join('\n\n---\n\n');

  return `# ${date} 학습 기록

## 📌 토픽

${topic}

## ❓ 질문 (3문제)

${questionsSection}

${answerSection}

${feedbackSection}

## 📚 모범 답안 & 개념 정리

${answersSection}
`;
}
