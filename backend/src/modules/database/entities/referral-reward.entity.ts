import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  RelationId,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { TransactionEntity } from './transaction.entity';

export enum ReferralRewardType {
  GAME_COMMISSION = 'game_commission',
}

export enum ReferralRewardStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('referral_rewards')
export class ReferralRewardEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  @Index('IDX_referral_rewards_referrer_id')
  referrer: UserEntity;

  @RelationId((reward: ReferralRewardEntity) => reward.referrer)
  referrerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referee_id' })
  @Index('IDX_referral_rewards_referee_id')
  referee: UserEntity;

  @RelationId((reward: ReferralRewardEntity) => reward.referee)
  refereeId: string;

  @Column({
    type: 'enum',
    enum: ReferralRewardType,
  })
  rewardType: ReferralRewardType;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  amount: string;

  @ManyToOne(() => TransactionEntity, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  @Index('IDX_referral_rewards_transaction_id')
  transaction?: TransactionEntity;

  @RelationId((reward: ReferralRewardEntity) => reward.transaction)
  transactionId?: string;

  @Column({
    type: 'enum',
    enum: ReferralRewardStatus,
    default: ReferralRewardStatus.PENDING,
  })
  @Index('IDX_referral_rewards_status')
  status: ReferralRewardStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}

