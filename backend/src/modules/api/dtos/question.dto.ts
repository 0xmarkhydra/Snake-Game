import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class QuestionWebhookDto {
  @ApiPropertyOptional({
    description: 'Event type for the question webhook',
    example: 'QuestionCreated',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiProperty({
    description: 'Question data - flexible structure, can contain any fields',
    example: {
      questionId: 'q123456',
      question: 'What is the capital of France?',
      answer: 'Paris',
      difficulty: 'medium',
      category: 'geography',
      metadata: {},
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
    description: 'Source or origin of the question',
    example: 'external-api',
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

