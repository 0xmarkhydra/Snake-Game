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

@Entity('user_sessions')
export class UserSessionEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @Index('IDX_user_sessions_user_id')
  user: UserEntity;

  @RelationId((session: UserSessionEntity) => session.user)
  userId: string;

  @Column({ name: 'jwt_id', type: 'uuid' })
  @Index('IDX_user_sessions_jwt_id')
  jwtId: string;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  @Index('IDX_user_sessions_refresh_token')
  refreshToken?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress?: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;
}
