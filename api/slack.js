// Vercel Serverless Function — Slack 이벤트 수신 및 피드백 응답
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import { generateFeedback } from '../lib/claude.js';
import { getQuestion, saveUserAnswer } from '../lib/redis.js';
import { postFeedback } from '../lib/slack.js';

function verifySlackSignature(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];

  // 5분 이상 지난 요청 거부 (리플레이 공격 방지)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const sigBase = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const hmac = crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(sigBase)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(`v0=${hmac}`),
    Buffer.from(signature),
  );
}

async function handleMessage(event) {
  const data = await getQuestion();
  if (!data) return; // 오늘 질문이 없으면 무시

  const userAnswer = event.text?.trim();
  if (!userAnswer) return;

  // 사용자 답변 저장
  await saveUserAnswer(userAnswer);

  // Claude 피드백 생성
  const feedback = await generateFeedback(data.question, userAnswer);

  // 스레드에 피드백 응답
  await postFeedback(event.channel, event.ts, feedback);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Slack 서명 검증
  if (!verifySlackSignature(req)) return res.status(401).end();

  const body = req.body;

  // Slack URL 인증 챌린지
  if (body.type === 'url_verification') {
    return res.status(200).json({ challenge: body.challenge });
  }

  if (body.type === 'event_callback') {
    const event = body.event;

    // 봇 메시지 및 서브타입 이벤트 무시
    if (event.bot_id || event.subtype) return res.status(200).end();

    // 지정 채널의 일반 메시지만 처리
    if (event.type === 'message' && event.channel === process.env.SLACK_CHANNEL_ID) {
      // Slack에 즉시 200 응답 후 백그라운드 처리
      res.status(200).end();
      waitUntil(handleMessage(event));
      return;
    }
  }

  return res.status(200).end();
}
