import {
  Column,
  Entity,
  Index,
  OneToMany,
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

  @OneToMany(() => UserSessionEntity, (session) => session.user)
  sessions: UserSessionEntity[];
}
