import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity('wallet_balances')
export class WalletBalanceEntity extends BaseEntity {
  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index('IDX_wallet_balances_user_id', { unique: true })
  user: UserEntity;

  @Column({ name: 'available_amount', type: 'numeric', precision: 18, scale: 6, default: 0 })
  availableAmount: string;

  @Column({ name: 'locked_amount', type: 'numeric', precision: 18, scale: 6, default: 0 })
  lockedAmount: string;

  @Column({ name: 'last_transaction_id', type: 'uuid', nullable: true })
  @Index('IDX_wallet_balances_last_transaction_id')
  lastTransactionId?: string;
}
