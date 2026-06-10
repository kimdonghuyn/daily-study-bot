// Vercel Edge Runtime — raw body로 Slack 서명 검증 후 피드백 응답
import { waitUntil } from '@vercel/functions';
import { generateFeedback, matchTopic, generateStudySummary } from '../lib/claude.js';
import {
  getQuestion, getQuestionForDate, getYesterdayDateKST,
  getQuestionTs,
  saveUserAnswer, saveFeedback, saveAnswerScore,
  saveStudyNote, saveStudySummary, saveTopicRequest, getCachedProfile,
} from '../lib/redis.js';

export const config = { runtime: 'edge' };

const LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500];

async function verifySlackSignature(headers, rawBody) {
  const timestamp = headers.get('x-slack-request-timestamp');
  const signature = headers.get('x-slack-signature');

  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const sigBase = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.SLACK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigBase));
  const hmac = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const expected = `v0=${hmac}`;
  if (expected.length !== signature.length) return false;

  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signature);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function slackPost(payload) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

// ── 피드백 응답 ───────────────────────────────────────────────────────────────

async function postFeedback(channelId, threadTs, feedback, score) {
  const scoreEmoji = score >= 80 ? '🏆' : score >= 60 ? '👍' : '📈';
  const scoreBlock = score != null
    ? [{ type: 'section', text: { type: 'mrkdwn', text: `📊 *정확도: ${score}점* ${scoreEmoji}  _(XP 반영: 오후 1시 리포트에 적용)_` } }]
    : [];

  await slackPost({
    channel: channelId,
    thread_ts: threadTs,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '💬 답변 피드백' } },
      { type: 'section', text: { type: 'mrkdwn', text: feedback } },
      { type: 'divider' },
      ...scoreBlock,
    ],
    text: feedback,
  });
}

// ── !학습 커맨드 응답 ─────────────────────────────────────────────────────────

async function postStudyAck(channelId, topic, summary) {
  await slackPost({
    channel: channelId,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📚 오늘의 학습 기록 완료!' } },
      { type: 'section', text: { type: 'mrkdwn', text: summary } },
      { type: 'divider' },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `내일 아침 *"${topic}"* 관련 질문 1문제를 보내드릴게요 🌅` }],
      },
    ],
    text: `오늘 학습 기록 완료! 내일 ${topic} 질문이 발송됩니다.`,
  });
}

// ── !상태 커맨드 응답 ─────────────────────────────────────────────────────────

async function postProfileStatus(channelId, profile) {
  if (!profile) {
    await slackPost({
      channel: channelId,
      text: '아직 학습 기록이 없습니다. 오늘 첫 답변을 남겨보세요! 🚀',
    });
    return;
  }

  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (profile.totalXP >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  const nextXP = LEVEL_XP[level] ?? '🏆';
  const prevXP = LEVEL_XP[level - 1] ?? 0;
  const toNext = typeof nextXP === 'number' ? nextXP - profile.totalXP : 0;
  const streakFire = profile.streak >= 7 ? '🔥🔥' : profile.streak >= 3 ? '🔥' : '';
  const badgeStr = profile.badges?.length > 0 ? profile.badges.join('  ') : '없음 — 첫 답변으로 뱃지를 획득하세요!';

  const filled = typeof nextXP === 'number'
    ? Math.round(((profile.totalXP - prevXP) / (nextXP - prevXP)) * 10)
    : 10;
  const bar = '█'.repeat(Math.min(filled, 10)) + '░'.repeat(Math.max(10 - filled, 0));

  await slackPost({
    channel: channelId,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🎮 나의 학습 현황' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*레벨*\nLv.${level}` },
          { type: 'mrkdwn', text: `*총 XP*\n${profile.totalXP} / ${nextXP}` },
          { type: 'mrkdwn', text: `*연속 학습*\n${profile.streak}일 ${streakFire}` },
          { type: 'mrkdwn', text: `*완료 퀘스트*\n${profile.questsCompleted}개` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*레벨 진행도*\n\`${bar}\` ${typeof nextXP === 'number' ? `다음 레벨까지 ${toNext} XP` : '최고 레벨!'}` },
      },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: `*🏅 보유 뱃지*\n${badgeStr}` } },
    ],
    text: `Lv.${level} | ${profile.totalXP} XP | 스트릭 ${profile.streak}일`,
  });
}

// ── 메시지 핸들러 ─────────────────────────────────────────────────────────────

async function handleStudyCommand(event, studyNote) {
  const topic = await matchTopic(studyNote);
  const summary = await generateStudySummary(studyNote, topic);

  await saveStudyNote(studyNote);
  await saveStudySummary(summary);
  await saveTopicRequest(topic);
  await postStudyAck(event.channel, topic, summary);
}

async function handleStatusCommand(event) {
  const profile = await getCachedProfile();
  await postProfileStatus(event.channel, profile);
}

async function handleAnswer(event) {
  // 질문 쓰레드 댓글인지 확인 — 오늘/어제 질문 ts와 일치해야 함
  const questionTs = await getQuestionTs();
  if (!questionTs || String(event.thread_ts) !== String(questionTs)) return;

  let questions = await getQuestion();
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    questions = await getQuestionForDate(getYesterdayDateKST());
  }
  if (!questions || !Array.isArray(questions) || questions.length === 0) return;

  const userAnswer = event.text?.trim();
  if (!userAnswer) return;

  await saveUserAnswer(userAnswer);
  const { score, feedback } = await generateFeedback(questions, userAnswer);
  await saveFeedback(feedback);
  await saveAnswerScore(score);
  // 피드백을 질문 쓰레드에 달기
  await postFeedback(event.channel, questionTs, feedback, score);
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────

export default async function handler(request) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  const rawBody = await request.text();

  if (!await verifySlackSignature(request.headers, rawBody)) {
    return new Response(null, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.type === 'event_callback') {
    const event = body.event;
    if (event.bot_id || event.subtype) return new Response(null, { status: 200 });

    if (event.type === 'message' && event.channel === process.env.SLACK_CHANNEL_ID) {
      const text = event.text?.trim() ?? '';

      if (text.startsWith('!학습 ')) {
        const studyNote = text.slice('!학습 '.length).trim();
        if (studyNote) {
          waitUntil(handleStudyCommand(event, studyNote));
          return new Response(null, { status: 200 });
        }
      }

      if (text === '!상태' || text === '!프로필') {
        waitUntil(handleStatusCommand(event));
        return new Response(null, { status: 200 });
      }

      waitUntil(handleAnswer(event));
      return new Response(null, { status: 200 });
    }
  }

  return new Response(null, { status: 200 });
}
