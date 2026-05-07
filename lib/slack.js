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

export async function postQuestions(questions) {
  const topic = questions[0].topic;

  const questionBlocks = questions.flatMap(q => [
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*${q.typeLabel}*` } },
    ...splitTextBlocks(q.question),
  ]);

  await slack.chat.postMessage({
    channel: CHANNEL,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🌅 오늘의 백엔드 학습 질문 (3문제)' },
      },
      {
        type: 'section',
        fields: [{ type: 'mrkdwn', text: `*오늘의 토픽*\n${topic}` }],
      },
      ...questionBlocks,
      { type: 'divider' },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '💬 이 채널에 답변을 남기면 AI 피드백을 드려요! 모범 답안은 오후 1시에 공개됩니다.' }],
      },
    ],
    text: `오늘의 토픽: ${topic} (개념 / 문제 / 면접 3문제)`,
  });
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

export async function postModelAnswer({ topic, questions, modelAnswers }) {
  const answerBlocks = questions.flatMap((q, i) => [
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*${q.typeLabel}*\n\n*❓ 질문*\n${q.question}` } },
    ...splitTextBlocks(modelAnswers[i]),
  ]);

  await slack.chat.postMessage({
    channel: CHANNEL,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📚 오늘의 모범 답안 & 개념 정리' },
      },
      {
        type: 'section',
        fields: [{ type: 'mrkdwn', text: `*토픽*\n${topic}` }],
      },
      ...answerBlocks,
    ],
    text: `오늘의 모범 답안: ${topic}`,
  });
}
