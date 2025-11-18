import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserSessionEntity } from './user-session.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ name: 'wallet_address', length: 64, unique: true })
  @Index()
  walletAddress: string;

  @Column({ name: 'display_name', length: 64, nullable: true })
  displayName?: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'referral_code', length: 16, unique: true, nullable: true })
  @Index('IDX_users_referral_code')
  referralCode?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'referred_by_id' })
  @Index('IDX_users_referred_by_id')
  referredBy?: UserEntity;

  @RelationId((user: UserEntity) => user.referredBy)
  referredById?: string;

  @Column({ name: 'referred_at', type: 'timestamptz', nullable: true })
  referredAt?: Date;

  @OneToMany(() => UserSessionEntity, (session) => session.user)
  sessions: UserSessionEntity[];
}
