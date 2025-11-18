import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class QuestionWebhookDto {
  @ApiProperty({
    description: 'Event type for the webhook (TaskCompleted, TaskFailed, ReferralCompleted)',
    example: 'TaskCompleted',
    enum: ['TaskCompleted', 'TaskFailed', 'ReferralCompleted'],
  })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({
    description: 'Task/Question data - flexible structure containing task information',
    example: {
      wallet_address: '6WP8YL4FRQhFK1Yui5SXKYxHrkmcVMTiF9unaYCApDA7',
      task_id: '550e8400-e29b-41d4-a716-446655440000',
      task_title: 'Like our announcement tweet',
      task_type: 'twitter_like',
      completed_at: '2025-01-15T10:30:00.000Z',
      verify_result: {
        verified: true,
        details: {},
      },
    },
  })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Timestamp when the question was created',
    example: 1762601253479,
  })
  @IsOptional()
  timestamp?: number;

  @ApiPropertyOptional({
    description: 'Source or origin of the webhook',
    example: 'web3-tasks-api',
  })
  @IsOptional()
  @IsString()
  source?: string;

  // Index signature for flexible additional fields (no decorator allowed)
  [key: string]: any;
}

export class QuestionWebhookResponseDto {
  @ApiProperty({
    description: 'Indicates if the webhook was processed successfully',
    example: true,
  })
  processed: boolean;

  @ApiPropertyOptional({
    description: 'Message about the processing result',
    example: 'Question received and processed successfully',
  })
  message?: string;
}

