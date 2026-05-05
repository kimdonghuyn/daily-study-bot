import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    concept: `당신은 백엔드 시니어 개발자입니다. "${topic}"에 대한 개념 학습 질문을 만들어주세요.
규칙:
- 단순 정의보다 "왜", "어떻게", "언제" 를 물어볼 것
- 실무와 연결되는 깊이 있는 질문
- 질문만 작성 (답변 포함 금지)
- 2~3문장 이내로 간결하게`,

    problem: `당신은 백엔드 시니어 개발자입니다. "${topic}"과 관련된 실무 문제 상황을 만들어주세요.
규칙:
- 실제로 일어날 법한 구체적인 장애/버그 시나리오
- "이 상황에서 어떻게 해결하겠습니까?" 형태
- 질문만 작성 (답변 포함 금지)
- 3~5문장으로 상황 묘사 후 질문`,

    interview: `당신은 네카라쿠배 수준 회사의 백엔드 면접관입니다. "${topic}"에 대한 기술 면접 질문을 만들어주세요.
규칙:
- 실제 면접에서 나올 법한 날카로운 질문
- 꼬리 질문으로 이어질 수 있는 열린 질문
- 질문만 작성 (답변 포함 금지)
- 1~2문장으로 명확하게`,
  };

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompts[type] }],
  });

  return {
    topic,
    type,
    typeLabel: TYPE_LABELS[type],
    question: message.content[0].text.trim(),
  };
}

export async function generateFeedback(question, userAnswer) {
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `백엔드 시니어 개발자로서 아래 답변에 피드백을 주세요.

[질문]
${question}

[사용자 답변]
${userAnswer}

피드백 형식:
✅ 잘한 점 (구체적으로)
⚠️ 보완할 점 (구체적으로)
💡 핵심 포인트 (놓친 부분 있다면)

간결하고 날카롭게, 성장에 도움이 되는 피드백을 주세요.`,
    }],
  });

  return message.content[0].text.trim();
}

export async function generateModelAnswer(question, topic) {
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `백엔드 시니어 개발자로서 아래 질문에 대한 최고 수준의 모범 답안과 개념 정리를 작성해주세요.

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
(면접에서 이어질 수 있는 질문 2~3개)`,
    }],
  });

  return message.content[0].text.trim();
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export { TOPIC_POOL, TYPE_LABELS };
