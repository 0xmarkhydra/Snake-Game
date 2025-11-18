import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { VipRoomType } from './vip-room-config.entity';

export enum VipTicketStatus {
  ISSUED = 'issued',
  CONSUMED = 'consumed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('vip_tickets')
export class VipTicketEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Index('IDX_vip_tickets_user_id')
  user: UserEntity;

  @Column({
    name: 'ticket_code',
    type: 'varchar',
    length: 64,
    unique: true,
  })
  ticketCode: string;

  @Column({
    name: 'room_type',
    type: 'enum',
    enum: VipRoomType,
    default: VipRoomType.SNAKE_VIP,
    enumName: 'vip_room_type_enum',
  })
  roomType: VipRoomType;

  @Column({
    name: 'entry_fee',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0,
  })
  entryFee: string;

  @Column({
    name: 'room_instance_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  @Index('IDX_vip_tickets_room_instance_id')
  roomInstanceId?: string;

  @Column({
    type: 'enum',
    enum: VipTicketStatus,
    enumName: 'vip_ticket_status_enum',
    default: VipTicketStatus.ISSUED,
  })
  @Index('IDX_vip_tickets_status')
  status: VipTicketStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
