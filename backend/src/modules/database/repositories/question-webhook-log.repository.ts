import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { QuestionWebhookLogEntity } from '../entities/question-webhook-log.entity';

@Injectable()
export class QuestionWebhookLogRepository extends Repository<QuestionWebhookLogEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(QuestionWebhookLogEntity, dataSource.createEntityManager());
  }
}

