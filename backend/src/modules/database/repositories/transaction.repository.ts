import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TransactionEntity } from '../entities/transaction.entity';

@Injectable()
export class TransactionRepository extends Repository<TransactionEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(TransactionEntity, dataSource.createEntityManager());
  }
}
