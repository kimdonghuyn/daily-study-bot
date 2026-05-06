// Vercel Serverless Function — Slack 이벤트 수신 및 피드백 응답
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import { generateFeedback } from '../lib/claude.js';
import { getQuestion, saveUserAnswer } from '../lib/redis.js';
import { postFeedback } from '../lib/slack.js';

function verifySlackSignature(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];

  if (!timestamp || !signature) {
    console.log('[slack] missing timestamp or signature');
    return false;
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    console.log('[slack] timestamp too old:', timestamp);
    return false;
  }

  const rawBody = JSON.stringify(req.body);
  const sigBase = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(sigBase)
    .digest('hex');

  const expected = `v0=${hmac}`;
  console.log('[slack] expected:', expected.slice(0, 16) + '...');
  console.log('[slack] received:', signature.slice(0, 16) + '...');
  console.log('[slack] secret len:', process.env.SLACK_SIGNING_SECRET?.length);
  console.log('[slack] body preview:', rawBody.slice(0, 80));

  try {
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signature);
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
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

  if (!verifySlackSignature(req)) return res.status(401).end();

  const body = req.body;

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
