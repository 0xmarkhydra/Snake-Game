import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum VipRoomType {
  SNAKE_VIP = 'snake_game_vip',
}

@Entity('vip_room_config')
export class VipRoomConfigEntity extends BaseEntity {
  @Column({
    name: 'room_type',
    type: 'enum',
    enum: VipRoomType,
    default: VipRoomType.SNAKE_VIP,
    enumName: 'vip_room_type_enum',
    unique: true,
  })
  @Index('UQ_vip_room_config_room_type', { unique: true })
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
    name: 'reward_rate_player',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0.9,
  })
  rewardRatePlayer: string;

  @Column({
    name: 'reward_rate_treasury',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0.1,
  })
  rewardRateTreasury: string;

  @Column({
    name: 'respawn_cost',
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0,
  })
  respawnCost: string;

  @Column({ name: 'max_clients', type: 'int', default: 20 })
  maxClients: number;

  @Column({ name: 'tick_rate', type: 'int', default: 60 })
  tickRate: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
