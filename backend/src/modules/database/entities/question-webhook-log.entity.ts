import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum WebhookEventType {
  TASK_COMPLETED = 'TaskCompleted',
  TASK_FAILED = 'TaskFailed',
  REFERRAL_COMPLETED = 'ReferralCompleted',
}

export enum WebhookProcessingStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity('question_webhook_logs')
export class QuestionWebhookLogEntity extends BaseEntity {
  @Column({
    name: 'event_type',
    type: 'enum',
    enum: WebhookEventType,
  })
  @Index('IDX_question_webhook_logs_event_type')
  eventType: WebhookEventType;

  @Column({
    name: 'task_id',
    type: 'uuid',
    nullable: true,
  })
  @Index('IDX_question_webhook_logs_task_id')
  taskId?: string;

  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  @Index('IDX_question_webhook_logs_wallet_address')
  walletAddress?: string;

  @Column({
    name: 'task_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  @Index('IDX_question_webhook_logs_task_type')
  taskType?: string;

  @Column({
    name: 'processing_status',
    type: 'enum',
    enum: WebhookProcessingStatus,
    default: WebhookProcessingStatus.PENDING,
  })
  @Index('IDX_question_webhook_logs_processing_status')
  processingStatus: WebhookProcessingStatus;

  @Column({
    name: 'source',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  source?: string;

  @Column({
    name: 'webhook_timestamp',
    type: 'bigint',
    nullable: true,
  })
  webhookTimestamp?: number;

  @Column({
    type: 'jsonb',
    nullable: false,
  })
  payload: Record<string, any>;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, unknown>;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage?: string;

  @Column({
    name: 'processed_at',
    type: 'timestamptz',
    nullable: true,
  })
  processedAt?: Date;
}

