export const TYPE_SEQUENCE = ['concept', 'problem', 'interview'];

export const TOPIC_POOL = [
  // Java / OOP (8)
  'JVM 메모리 구조 (Heap, Stack, Method Area)',
  'GC의 필요성과 동작 원리',
  'GC 알고리즘 종류 (Serial, G1, ZGC)',
  '캡슐화와 접근 제어자',
  '상속과 다형성',
  '추상화 — 인터페이스 vs 추상클래스',
  'SOLID — SRP와 OCP',
  'SOLID — LSP, ISP, DIP',
  // Spring (8)
  'IoC와 DI — 왜 직접 객체를 만들지 않나',
  'Spring Bean 생명주기와 스코프',
  'Spring AOP — 어떤 문제를 해결하나',
  '프록시 패턴과 AOP 내부 동작 원리',
  '@Transactional 기본 동작',
  '@Transactional 전파 수준과 롤백 규칙',
  'Spring MVC — DispatcherServlet과 요청 흐름',
  'Filter vs Interceptor vs AOP',
  // DB (6)
  '인덱스 개념 — 왜 빠른가',
  'B-Tree 인덱스 구조와 활용 전략',
  '트랜잭션과 ACID',
  '트랜잭션 격리 수준 4단계',
  'N+1 문제와 해결 방법',
  'Optimistic Lock vs Pessimistic Lock',
  // Redis / 캐싱 (4)
  'Redis란 무엇인가 — 언제 DB 대신 쓰나',
  'Redis 자료구조 5가지',
  '캐시 읽기 전략 (Look-aside, Read-through)',
  '캐시 쓰기 전략 (Write-through, Write-back)',
  // API / 인증 (4)
  'HTTP 기본 — 메서드, 상태코드, 헤더',
  'REST API 설계 원칙과 멱등성',
  'JWT 구조와 인증 방식',
  'OAuth2 인증 흐름 (Authorization Code)',
  // 인프라 (4)
  'Docker 개념 — VM과 차이, 왜 쓰나',
  'Docker 이미지와 컨테이너 동작 방식',
  'Kubernetes 기본 (Pod, Service, Deployment)',
  '동시성 문제 — Race Condition과 Deadlock',
  // 메시징 / 아키텍처 (5)
  'Kafka — 왜 메시지 큐를 쓰나',
  'Kafka 구조 — Topic, Partition, Consumer Group',
  'MSA vs 모놀리식 트레이드오프',
  'CAP 정리',
  'Circuit Breaker 패턴',
];

export const CYCLE_LENGTH = TOPIC_POOL.length * TYPE_SEQUENCE.length; // 117

export const CURRICULUM = [
  { category: '☕ Java / OOP',         topics: TOPIC_POOL.slice(0, 8)  },
  { category: '🍃 Spring',             topics: TOPIC_POOL.slice(8, 16) },
  { category: '🗄️ DB',                topics: TOPIC_POOL.slice(16, 22) },
  { category: '📦 Redis / 캐싱',       topics: TOPIC_POOL.slice(22, 26) },
  { category: '🌐 API / 인증',         topics: TOPIC_POOL.slice(26, 30) },
  { category: '☁️ 인프라',             topics: TOPIC_POOL.slice(30, 34) },
  { category: '🏗️ 메시징 / 아키텍처', topics: TOPIC_POOL.slice(34, 39) },
];
