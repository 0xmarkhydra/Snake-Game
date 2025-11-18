import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { VipTicketEntity } from '../entities/vip-ticket.entity';

@Injectable()
export class VipTicketRepository extends Repository<VipTicketEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(VipTicketEntity, dataSource.createEntityManager());
  }
}
