import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  REWARD = 'reward',
  PENALTY = 'penalty',
  SYSTEM_ADJUST = 'system_adjust',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('transactions')
export class TransactionEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index('IDX_transactions_user_id')
  user: UserEntity;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  amount: string;

  @Column({
    name: 'fee_amount',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0,
  })
  feeAmount: string;

  @Column({ unique: true, nullable: true })
  signature?: string;

  @Column({ name: 'reference_code', unique: true, nullable: true })
  referenceCode?: string;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  @Index('IDX_transactions_reference_id')
  referenceId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'webhook_event_id', type: 'uuid', nullable: true })
  @Index('IDX_transactions_webhook_event_id')
  webhookEventId?: string;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;
}
