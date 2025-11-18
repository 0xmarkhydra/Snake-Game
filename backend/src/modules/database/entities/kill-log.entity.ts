import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { VipRoomType } from './vip-room-config.entity';
import { VipTicketEntity } from './vip-ticket.entity';

@Entity('kill_logs')
export class KillLogEntity extends BaseEntity {
  @Column({
    name: 'room_instance_id',
    type: 'varchar',
    length: 64,
  })
  @Index('IDX_kill_logs_room_instance_id')
  roomInstanceId: string;

  @Column({
    name: 'kill_reference',
    type: 'varchar',
    length: 64,
    unique: true,
  })
  @Index('UQ_kill_logs_kill_reference', { unique: true })
  killReference: string;

  @Column({
    name: 'room_type',
    type: 'enum',
    enum: VipRoomType,
    default: VipRoomType.SNAKE_VIP,
    enumName: 'vip_room_type_enum',
  })
  roomType: VipRoomType;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'killer_user_id' })
  @Index('IDX_kill_logs_killer_user_id')
  killerUser?: UserEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'victim_user_id' })
  @Index('IDX_kill_logs_victim_user_id')
  victimUser?: UserEntity;

  @ManyToOne(() => VipTicketEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'killer_ticket_id' })
  @Index('IDX_kill_logs_killer_ticket_id')
  killerTicket?: VipTicketEntity;

  @ManyToOne(() => VipTicketEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'victim_ticket_id' })
  @Index('IDX_kill_logs_victim_ticket_id')
  victimTicket?: VipTicketEntity;

  @Column({
    name: 'reward_amount',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0,
  })
  rewardAmount: string;

  @Column({
    name: 'fee_amount',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0,
  })
  feeAmount: string;

  @Column({
    name: 'occurred_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  occurredAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
