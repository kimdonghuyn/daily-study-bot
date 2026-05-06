// Vercel Edge Runtime — raw body로 Slack 서명 검증 후 피드백 응답
import { waitUntil } from '@vercel/functions';
import { generateFeedback } from '../lib/claude.js';
import { getQuestion, saveUserAnswer } from '../lib/redis.js';

export const config = { runtime: 'edge' };

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

async function postFeedback(channelId, threadTs, feedback) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      thread_ts: threadTs,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '💬 답변 피드백' } },
        { type: 'section', text: { type: 'mrkdwn', text: feedback } },
      ],
      text: feedback,
    }),
  });
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
      waitUntil(handleMessage(event));
      return new Response(null, { status: 200 });
    }
  }

  return new Response(null, { status: 200 });
}
