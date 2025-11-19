import { registerAs } from '@nestjs/config';

export const configQuestion = registerAs('question', () => ({
  webhookSecret: process.env.QUESTION_WEBHOOK_SECRET,
}));

