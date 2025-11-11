import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { KillLogEntity } from '../entities/kill-log.entity';

@Injectable()
export class KillLogRepository extends Repository<KillLogEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(KillLogEntity, dataSource.createEntityManager());
  }
}
