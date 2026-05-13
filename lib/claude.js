import Anthropic from '@anthropic-ai/sdk';
import { TOPIC_POOL, TYPE_SEQUENCE, CYCLE_LENGTH } from './topics.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generate(prompt, maxTokens = 800) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text.trim();
}

const TYPE_LABELS = {
  concept:   '📖 개념 설명',
  problem:   '🔧 문제 상황',
  interview: '🎤 면접 질문',
};

function getDifficultyGuide(cycle) {
  if (cycle === 0) {
    return `대상 수준: 신입 / 이제 막 공부를 시작한 개발자
- 개념의 정의와 "왜 필요한가"에 집중
- 추상적 이론보다 직관적인 비유와 예시 사용
- 코드나 세부 구현보다 큰 그림 이해
- 짧고 명확하게, 한 가지만 물어볼 것`;
  }
  if (cycle === 1) {
    return `대상 수준: 주니어 개발자 (0-1년차)
- 개념 이해 + 기본 실무 적용
- "어떻게 쓰나", "어떤 상황에서 쓰나" 중심
- Spring Boot, JPA, MySQL 등 일반적인 스택 기준
- 간단한 실무 상황 포함 가능`;
  }
  return `대상 수준: 3년차 실무 개발자
- 내부 동작 원리, 트레이드오프, 성능 최적화
- 실무에서 마주치는 엣지케이스와 설계 선택
- 장애 상황, 코드 품질, 팀 내 기술 선택 관점`;
}

function buildPrompt(topic, type, diffGuide, cycle) {
  if (type === 'concept') {
    return `당신은 백엔드 개발 멘토입니다. "${topic}"에 대한 질문을 1개 만들어주세요.
${diffGuide}

규칙:
- 질문은 3~5문장 이내로 짧게
- 단순 정의가 아닌 "왜", "어떻게"를 묻는 질문
- 마크다운 헤더(##, #) 절대 사용 금지
- 질문만 작성 (답변 포함 금지)`;
  }

  if (type === 'problem') {
    const companyContext = cycle === 0 ? '' : `아래 회사 중 이 토픽과 가장 잘 어울리는 곳 하나를 골라 그 회사의 실제 서비스 맥락으로 상황을 구성하세요:
- 오늘의집: 인테리어 커머스, 상품 피드, 이미지 대용량 트래픽
- 무신사: 패션 이커머스, 한정판 드롭 시 순간 트래픽
- 컬리: 새벽 배송, 자정 주문 마감, 신선식품 배송
- 올리브영: 온·오프라인 재고 동기화, 당일 배송
- 배달의민족: 실시간 주문·라이더 매칭, 피크타임 급증

`;

    return `당신은 백엔드 개발 멘토입니다. "${topic}"과 관련된 문제 상황을 만들어주세요.
${diffGuide}
${companyContext}규칙:
- 상황 설명 + "어떻게 접근하겠는가?" 형태로 짧게
- 전체 4~7문장 이내
- 마크다운 헤더(##, #) 절대 사용 금지
- 질문만 작성 (답변 포함 금지)`;
  }

  // interview
  const followUpCount = cycle === 0 ? '꼬리 질문 1개' : '꼬리 질문 2~3개';
  return `당신은 백엔드 기술 면접관입니다. "${topic}"에 대한 면접 질문을 만들어주세요.
${diffGuide}

규칙:
- 메인 질문 1개 + ${followUpCount}
- 자연스럽게 이어지는 구성
- 마크다운 헤더(##, #) 절대 사용 금지
- 질문만 작성 (답변 포함 금지)`;
}

// ── 질문 생성 (하루 1문제) ────────────────────────────────────────────────────

export async function generateDailyQuestion(topic, type, cycle) {
  const diffGuide = getDifficultyGuide(cycle);
  const question = await generate(buildPrompt(topic, type, diffGuide, cycle), 600);
  return [{ topic, type, typeLabel: TYPE_LABELS[type], question }];
}

// ── 피드백 + 점수 채점 ────────────────────────────────────────────────────────

export async function generateFeedback(questions, userAnswer) {
  const topic = questions[0].topic;
  const questionsText = questions
    .map((q, i) => `[질문 ${i + 1} - ${q.typeLabel}]\n${q.question}`)
    .join('\n\n');

  const raw = await generate(`백엔드 시니어 개발자로서 아래 답변을 평가하고 피드백을 주세요.

오늘의 토픽: ${topic}

${questionsText}

[사용자 답변]
${userAnswer}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "score": 답변 정확도 0~100 사이 정수,
  "feedback": "✅ 잘한 점 (구체적으로)\\n⚠️ 보완할 점 (구체적으로)\\n💡 핵심 포인트 (놓친 부분 있다면)"
}`, 1000);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { score: Number(parsed.score), feedback: String(parsed.feedback) };
    }
  } catch { /* fall through */ }

  return { score: 50, feedback: raw };
}

// ── 모범 답안 ─────────────────────────────────────────────────────────────────

export async function generateModelAnswer(questions, topic) {
  return Promise.all(
    questions.map(q =>
      generate(`백엔드 시니어 개발자로서 아래 질문에 대한 모범 답안과 핵심 개념 정리를 작성해주세요.

[토픽] ${topic}
[유형] ${q.typeLabel}
[질문] ${q.question}

답변 형식:
## 모범 답안
(핵심을 짚는 명확한 답변)

## 핵심 개념 정리
(알아야 할 개념들을 bullet point로)

## 실무 포인트
(실제 현장에서 어떻게 적용되는지)`, 2500)
    )
  );
}

// ── !학습 커맨드 ──────────────────────────────────────────────────────────────

export async function matchTopic(studyNote) {
  const topicList = TOPIC_POOL.join('\n');
  const result = await generate(`사용자가 오늘 공부한 내용:
"${studyNote}"

아래 토픽 목록 중에서 이 내용과 가장 관련 있는 토픽 하나를 골라 정확히 그 토픽 이름만 출력하세요. 절대 다른 말은 하지 마세요.

토픽 목록:
${topicList}`, 100);

  const trimmed = result.trim();
  const exact = TOPIC_POOL.find(t => t === trimmed);
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  const fuzzy = TOPIC_POOL.find(t =>
    t.toLowerCase().includes(lower.slice(0, 5)) || lower.includes(t.toLowerCase().slice(0, 5))
  );
  return fuzzy || pickRandom(TOPIC_POOL);
}

export async function generateStudySummary(studyNote, matchedTopic) {
  return generate(`백엔드 개발자가 오늘 학습한 내용을 간결하게 정리해주세요.

학습 내용: "${studyNote}"
관련 토픽: ${matchedTopic}

형식:
✅ 핵심 개념 요약 (2~3줄)
🔑 놓치지 말아야 할 포인트 (bullet 2~3개)
📚 내일 복습 포인트`, 400);
}

// ── 학습 가이드 생성 (study.js용) ─────────────────────────────────────────────

export async function generateStudyGuide(topic, type, cycle) {
  const diffGuide = getDifficultyGuide(cycle);
  const typeContext = type === 'concept' ? '개념 이해'
    : type === 'problem' ? '문제 해결 사고력'
    : '면접 답변 능력';

  return generate(`당신은 친절한 백엔드 개발 멘토입니다. 오늘 "${topic}"을 가르쳐야 합니다.
오늘 집중할 역량: ${typeContext}

${diffGuide}

아래 형식으로 학습 가이드를 작성해주세요:

## 📌 오늘의 주제
[주제 소개 — 왜 중요하고 어떤 상황에서 만나게 되는지 2~3문장]

## 🎯 학습 목표
[오늘 이것만 이해하면 성공! 체크리스트 3~5개]

## 📖 핵심 개념 설명
[신입 눈높이 설명 — 비유·예시·단계별 흐름 위주, 어려운 용어는 바로 풀어서 설명]

## 💡 한 줄 정리
[오늘 배운 핵심을 딱 한 문장으로]`, 2000);
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export { TOPIC_POOL, TYPE_LABELS, TYPE_SEQUENCE, CYCLE_LENGTH };
