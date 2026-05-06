// Vercel Serverless Function — Slack 이벤트 수신 및 피드백 응답
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import { generateFeedback } from '../lib/claude.js';
import { getQuestion, saveUserAnswer } from '../lib/redis.js';
import { postFeedback } from '../lib/slack.js';

// raw body를 읽어야 Slack 서명 검증이 정확히 동작함
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySlackSignature(rawBody, headers) {
  const timestamp = headers['x-slack-request-timestamp'];
  const signature = headers['x-slack-signature'];

  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const sigBase = `v0:${timestamp}:${rawBody.toString()}`;
  const hmac = crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(sigBase)
    .digest('hex');

  const expected = Buffer.from(`v0=${hmac}`);
  const received = Buffer.from(signature);

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

async function handleMessage(event) {
  const data = await getQuestion();
  if (!data) return;

  const userAnswer = event.text?.trim();
  if (!userAnswer) return;

  await saveUserAnswer(userAnswer);

  const feedback = await generateFeedback(data.question, userAnswer);
  await postFeedback(event.channel, event.ts, feedback);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);

  if (!verifySlackSignature(rawBody, req.headers)) {
    return res.status(401).end();
  }

  const body = JSON.parse(rawBody.toString());

  if (body.type === 'url_verification') {
    return res.status(200).json({ challenge: body.challenge });
  }

  if (body.type === 'event_callback') {
    const event = body.event;

    if (event.bot_id || event.subtype) return res.status(200).end();

    if (event.type === 'message' && event.channel === process.env.SLACK_CHANNEL_ID) {
      res.status(200).end();
      waitUntil(handleMessage(event));
      return;
    }
  }

  return res.status(200).end();
}
