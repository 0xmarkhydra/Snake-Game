import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminConfigRepository,
  KillLogRepository,
  ReferralRewardRepository,
  TransactionRepository,
  UserRepository,
  UserSessionRepository,
  VipRoomConfigRepository,
  VipTicketRepository,
  WalletBalanceRepository,
  QuestionWebhookLogRepository,
} from './repositories';
import {
  AdminConfigEntity,
  KillLogEntity,
  ReferralRewardEntity,
  TransactionEntity,
  UserEntity,
  UserSessionEntity,
  VipRoomConfigEntity,
  VipTicketEntity,
  WalletBalanceEntity,
  QuestionWebhookLogEntity,
} from './entities';
import { SeedDatabase } from './seeders/seed.database';

const repositories = [
  AdminConfigRepository,
  TransactionRepository,
  KillLogRepository,
  ReferralRewardRepository,
  UserRepository,
  UserSessionRepository,
  VipRoomConfigRepository,
  VipTicketRepository,
  WalletBalanceRepository,
  QuestionWebhookLogRepository,
];

const services = [];

const entities = [
  AdminConfigEntity,
  TransactionEntity,
  KillLogEntity,
  ReferralRewardEntity,
  UserEntity,
  UserSessionEntity,
  VipRoomConfigEntity,
  VipTicketEntity,
  WalletBalanceEntity,
  QuestionWebhookLogEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => config.get('db'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configDb],
    }),
  ],
  controllers: [],
  providers: [...repositories, ...services, SeedDatabase],
  exports: [...repositories, ...services],
})
export class DatabaseModule {}
