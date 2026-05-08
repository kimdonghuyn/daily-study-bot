// 오늘의 로드맵 토픽/유형 출력 — /학습 커맨드에서 사용
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

const TYPE_SEQUENCE = ['concept', 'problem', 'interview'];
const TYPE_LABELS = { concept: '📖 개념 설명', problem: '🔧 문제 상황', interview: '🎤 면접 질문' };

async function fetchDayNumber() {
  const token = process.env.STUDY_GITHUB_TOKEN;
  if (!token) return 0;

  try {
    const res = await fetch(
      'https://api.github.com/repos/kimdonghuyn/daily-study/contents/profile.json?ref=master',
      { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'daily-study-bot' } }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const profile = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    return profile.dayNumber || 0;
  } catch {
    return 0;
  }
}

const dayNumber = await fetchDayNumber();
const topicIndex = Math.floor(dayNumber / 3) % TOPIC_POOL.length;
const type = TYPE_SEQUENCE[dayNumber % 3];

console.log(JSON.stringify({
  topic: TOPIC_POOL[topicIndex],
  type,
  typeLabel: TYPE_LABELS[type],
  dayNumber,
  topicIndex,
  totalTopics: TOPIC_POOL.length,
}));
