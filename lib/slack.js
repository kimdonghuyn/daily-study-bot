import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL = process.env.SLACK_CHANNEL_ID;

function splitTextBlocks(text, limit = 2900) {
  const blocks = [];
  let remaining = text;
  while (remaining.length > limit) {
    const cutAt = remaining.lastIndexOf('\n', limit);
    const splitAt = cutAt > 0 ? cutAt : limit;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: remaining.slice(0, splitAt) } });
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: remaining } });
  }
  return blocks;
}

export async function postQuestions(questions, recap = null) {
  const topic = questions[0].topic;
  const q = questions[0];

  // 어제 학습 복습 요약 (있을 때만)
  if (recap) {
    await slack.chat.postMessage({
      channel: CHANNEL,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '📝 어제 학습 복습' } },
        { type: 'section', text: { type: 'mrkdwn', text: recap } },
      ],
      text: '어제 학습 복습',
    });
  }

  // 질문을 단일 메시지로 — 이 ts로 쓰레드를 묶음
  const res = await slack.chat.postMessage({
    channel: CHANNEL,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🌅 오늘의 백엔드 학습 질문' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${topic}*  ·  ${q.typeLabel}` } },
      { type: 'divider' },
      ...splitTextBlocks(q.question),
      { type: 'context', elements: [{ type: 'mrkdwn', text: '💬 이 메시지에 *댓글*로 답변하면 AI 피드백을 드려요! 모범 답안은 오후 1시에 공개됩니다.' }] },
    ],
    text: `[${topic}] ${q.question.slice(0, 100)}`,
  });

  return res.ts;
}

export async function postFeedback(channelId, threadTs, feedback) {
  await slack.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '💬 답변 피드백' },
      },
      ...splitTextBlocks(feedback),
    ],
    text: feedback,
  });
}

export async function postModelAnswer({ topic, questions, modelAnswers, threadTs }) {
  const q = questions[0];
  const target = { channel: CHANNEL, ...(threadTs ? { thread_ts: threadTs } : {}) };

  await slack.chat.postMessage({
    ...target,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📚 모범 답안 & 개념 정리' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${topic}*  ·  ${q.typeLabel}` } },
      { type: 'divider' },
      ...splitTextBlocks(modelAnswers[0]),
    ],
    text: `모범 답안: ${topic}`,
  });
}
