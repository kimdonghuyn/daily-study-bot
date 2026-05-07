import Anthropic from '@anthropic-ai/sdk';

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

// 로드맵 Phase 1 기준 토픽 풀
const TOPIC_POOL = [
  'JVM 동작 원리 및 GC',
  'OOP 4대 원칙 (캡슐화, 상속, 다형성, 추상화)',
  'SOLID 원칙',
  'Spring IoC / DI / Bean 생명주기',
  'Spring AOP와 프록시 패턴',
  '@Transactional 전파 수준과 롤백',
  'Spring MVC 요청 처리 흐름',
  'DB 인덱스 (B-Tree) 동작 원리',
  'ACID와 트랜잭션 격리 수준',
  'N+1 문제와 해결 방법',
  'Redis 자료구조와 사용 사례',
  '캐싱 전략 (Look-aside, Write-through, Write-back)',
  'REST API 설계 원칙과 멱등성',
  'Kafka 기본 개념 (Topic, Partition, Consumer Group)',
  'MSA vs 모놀리식 트레이드오프',
  'CAP 정리',
  'Circuit Breaker 패턴',
  '동시성 문제와 Lock 전략',
  'OAuth2 & JWT 인증 흐름',
  'Docker & Kubernetes 기초',
];

function getDifficultyGuide(level) {
  if (level <= 2) {
    return `대상 수준: 3년차 실무 개발자
- 일상적인 실무 상황 중심, 추상적 이론 지양
- "왜 쓰는지", "언제 쓰는지"를 중심으로
- 교과서 개념보다 실제 코드/장애/선택 상황
- Spring Boot, JPA, MySQL 등 일반적인 스택 기준
- 너무 깊은 내부 구현보다 실무 적용 관점`;
  } else if (level <= 4) {
    return `대상 수준: 4-5년차 개발자
- 내부 동작 원리, 트레이드오프, 성능 최적화
- 실무에서 마주치는 엣지케이스와 설계 선택
- 팀 리드 관점의 기술 결정`;
  } else {
    return `대상 수준: 시니어/아키텍트
- 대규모 시스템 설계, 고가용성, 분산 환경
- 복잡한 트레이드오프, 조직 전체 영향 고려
- 아키텍처 결정과 기술 부채 관점`;
  }
}

// ── 질문 생성 ─────────────────────────────────────────────────────────────────

export async function generateDailyQuestions(topic, level) {
  const diffGuide = getDifficultyGuide(level);

  const prompts = {
    concept: `당신은 백엔드 시니어 개발자입니다. "${topic}"에 대한 깊이 있는 개념 질문을 만들어주세요.
${diffGuide}
규칙:
- 단순 정의가 아닌 "왜", "어떻게", "어떤 상황에서"를 묻는 질문
- 배경 맥락을 충분히 설명해서 무엇을 생각해야 하는지 명확하게
- 핵심 개념 + 트레이드오프 + 실무 적용을 모두 고민하게 만드는 깊이
- 생각할 방향을 여러 각도로 제시해도 좋음 (단, 답은 포함 금지)
- 마크다운 헤더(##, #) 절대 사용 금지
- 질문만 작성 (답변 포함 금지)`,

    problem: `당신은 백엔드 시니어 개발자입니다. "${topic}"과 관련된 실무 장애 시나리오를 만들어주세요.
${diffGuide}

아래 회사 중 이 토픽과 가장 잘 어울리는 곳 하나를 골라 그 회사의 실제 서비스 맥락으로 상황을 구성하세요:

- 오늘의집 (버킷플레이스): 인테리어 커머스 + 커뮤니티. 상품 피드, 이미지 대용량, 콘텐츠 + 결제 혼합 트래픽
- 무신사: 패션 이커머스. 한정판 드롭 시 순간 트래픽 폭발, 재고 동시성, 등급별 선구매
- 컬리: 새벽 배송 커머스. 자정 주문 마감, 신선식품 재고/배송 타임라인, 주문 확정 배치
- 올리브영: 옴니채널 뷰티 리테일. 온·오프라인 재고 동기화, 당일 배송, 멤버십 포인트
- 배달의민족: 음식 배달 플랫폼. 실시간 주문·라이더 매칭, 가게 상태 관리, 피크타임 급증

규칙:
- 선택한 회사 이름과 서비스 맥락을 자연스럽게 녹여서 현실감 있게
- 환경, 증상, 로그나 수치 등 구체적인 단서 포함
- 원인 분석 → 해결 → 재발 방지까지 고민하게 만드는 깊이
- 마지막에 "어떻게 접근하겠는가?" 형태의 질문으로 마무리
- 마크다운 헤더(##, #) 절대 사용 금지
- 질문만 작성 (답변 포함 금지)`,

    interview: `당신은 백엔드 기술 면접관입니다. "${topic}"에 대한 기술 면접 질문을 만들어주세요.
${diffGuide}
규칙:
- 원리와 실무 적용을 설명해야 하는 메인 질문 1개
- 꼬리 질문 3~4개: 엣지케이스, 트레이드오프, 다른 기술과의 비교, 장애 경험 등
- 면접관이 실제로 파고드는 방식으로 자연스럽게 이어지는 구성
- 마크다운 헤더(##, #) 절대 사용 금지
- 질문만 작성 (답변 포함 금지)`,
  };

  const [concept, problem, interview] = await Promise.all([
    generate(prompts.concept, 800),
    generate(prompts.problem, 800),
    generate(prompts.interview, 800),
  ]);

  return [
    { topic, type: 'concept',   typeLabel: TYPE_LABELS.concept,   question: concept },
    { topic, type: 'problem',   typeLabel: TYPE_LABELS.problem,   question: problem },
    { topic, type: 'interview', typeLabel: TYPE_LABELS.interview, question: interview },
  ];
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
(실제 현장에서 어떻게 적용되는지)`, 1200)
    )
  );
}

// ── !학습 커맨드 — 학습 내용 → 가장 가까운 토픽 매핑 ──────────────────────────

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

// ── !학습 커맨드 — 학습 요약 생성 ────────────────────────────────────────────

export async function generateStudySummary(studyNote, matchedTopic) {
  return generate(`백엔드 개발자가 오늘 학습한 내용을 간결하게 정리해주세요.

학습 내용: "${studyNote}"
관련 토픽: ${matchedTopic}

형식:
✅ 핵심 개념 요약 (2~3줄)
🔑 놓치지 말아야 할 포인트 (bullet 2~3개)
📚 내일 복습 포인트`, 400);
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export { TOPIC_POOL, TYPE_LABELS };
