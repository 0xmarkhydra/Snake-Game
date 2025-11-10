import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminConfigRepository,
  TransactionRepository,
  UserRepository,
  UserSessionRepository,
  WalletBalanceRepository,
} from './repositories';
import {
  AdminConfigEntity,
  TransactionEntity,
  UserEntity,
  UserSessionEntity,
  WalletBalanceEntity,
} from './entities';
import { SeedDatabase } from './seeders/seed.database';

const repositories = [
  AdminConfigRepository,
  TransactionRepository,
  UserRepository,
  UserSessionRepository,
  WalletBalanceRepository,
];

const services = [];

const entities = [
  AdminConfigEntity,
  TransactionEntity,
  UserEntity,
  UserSessionEntity,
  WalletBalanceEntity,
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
