import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ReferralRewardEntity } from '../entities/referral-reward.entity';

@Injectable()
export class ReferralRewardRepository extends Repository<ReferralRewardEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(ReferralRewardEntity, dataSource.createEntityManager());
  }
}

