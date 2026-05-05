import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL = process.env.SLACK_CHANNEL_ID;

export async function postQuestion({ topic, typeLabel, question }) {
  await slack.chat.postMessage({
    channel: CHANNEL,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🌅 오늘의 백엔드 학습 질문' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*토픽*\n${topic}` },
          { type: 'mrkdwn', text: `*유형*\n${typeLabel}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*❓ 질문*\n${question}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '💬 이 채널에 답변을 남기면 피드백을 드려요! 모범 답안은 오후 1시에 공개됩니다.' }],
      },
    ],
    text: `오늘의 질문: ${question}`,
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
      {
        type: 'section',
        text: { type: 'mrkdwn', text: feedback },
      },
    ],
    text: feedback,
  });
}

export async function postModelAnswer({ topic, question, answer }) {
  await slack.chat.postMessage({
    channel: CHANNEL,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📚 오늘의 모범 답안 & 개념 정리' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*토픽*\n${topic}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*❓ 오늘의 질문*\n${question}` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: answer },
      },
    ],
    text: `오늘의 모범 답안: ${topic}`,
  });
}
