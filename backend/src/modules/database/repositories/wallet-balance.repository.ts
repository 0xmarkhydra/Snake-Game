import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WalletBalanceEntity } from '../entities/wallet-balance.entity';

@Injectable()
export class WalletBalanceRepository extends Repository<WalletBalanceEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(WalletBalanceEntity, dataSource.createEntityManager());
  }
}
