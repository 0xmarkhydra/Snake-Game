import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserSessionEntity } from '../entities/user-session.entity';

@Injectable()
export class UserSessionRepository extends Repository<UserSessionEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(UserSessionEntity, dataSource.createEntityManager());
  }
}
