import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { VipRoomConfigEntity } from '../entities/vip-room-config.entity';

@Injectable()
export class VipRoomConfigRepository extends Repository<VipRoomConfigEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(VipRoomConfigEntity, dataSource.createEntityManager());
  }
}
