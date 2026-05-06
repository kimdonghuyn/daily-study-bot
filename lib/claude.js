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

const QUESTION_TYPES = ['concept', 'problem', 'interview'];

const TYPE_LABELS = {
  concept:   '📖 개념 설명',
  problem:   '🔧 문제 상황',
  interview: '🎤 면접 질문',
};

// 로드맵 Phase 1 기준 토픽 풀 (추후 Phase 진행에 따라 확장)
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

export async function generateQuestion(topic, type) {
  const prompts = {
    concept: `당신은 백엔드 시니어 개발자입니다. "${topic}"에 대해 깊이 생각해야 하는 개념 질문을 만들어주세요.
규칙:
- 단순 정의가 아닌 "왜", "어떻게", "어떤 상황에서"를 묻는 질문
- 내부 동작 원리 + 트레이드오프 + 실무 적용을 모두 고민해야 완전한 답이 나오는 깊이
- 질문만 작성 (답변 포함 금지)
- 2~3문장 이내로 간결하고 날카롭게 (장황하게 쓰지 말 것)`,

    problem: `당신은 백엔드 시니어 개발자입니다. "${topic}"과 관련된 실무 장애 상황을 만들어주세요.
규칙:
- 실제 발생할 법한 구체적인 장애/버그 시나리오
- 원인 분석 → 해결 → 재발 방지를 고민해야 하는 깊이
- 질문만 작성 (답변 포함 금지)
- 상황 묘사 3문장 + 질문 1문장, 총 4문장 이내로 간결하게`,

    interview: `당신은 네카라쿠배 수준 회사의 백엔드 면접관입니다. "${topic}"에 대한 기술 면접 질문을 만들어주세요.
규칙:
- 원리와 트레이드오프를 설명해야 하는 날카로운 질문
- 꼬리 질문 2개 포함
- 질문만 작성 (답변 포함 금지)
- 메인 질문 1문장 + 꼬리 질문 각 1문장, 총 3문장 이내로 간결하게`,
  };

  const question = await generate(prompts[type], 350);

  return {
    topic,
    type,
    typeLabel: TYPE_LABELS[type],
    question,
  };
}

export async function generateFeedback(question, userAnswer) {
  return generate(`백엔드 시니어 개발자로서 아래 답변에 피드백을 주세요.

[질문]
${question}

[사용자 답변]
${userAnswer}

피드백 형식:
✅ 잘한 점 (구체적으로)
⚠️ 보완할 점 (구체적으로)
💡 핵심 포인트 (놓친 부분 있다면)

간결하고 날카롭게, 성장에 도움이 되는 피드백을 주세요.`, 800);
}

export async function generateModelAnswer(question, topic) {
  return generate(`백엔드 시니어 개발자로서 아래 질문에 대한 최고 수준의 모범 답안과 개념 정리를 작성해주세요.

[토픽] ${topic}
[질문] ${question}

답변 형식:
## 모범 답안
(핵심을 짚는 명확한 답변)

## 핵심 개념 정리
(알아야 할 개념들을 bullet point로)

## 실무 포인트
(실제 현장에서 어떻게 적용되는지)

## 꼬리 질문 대비
(면접에서 이어질 수 있는 질문 2~3개)`, 1500);
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export { TOPIC_POOL, TYPE_LABELS };
