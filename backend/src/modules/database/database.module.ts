import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminConfigRepository,
  UserRepository,
  UserSessionRepository,
} from './repositories';
import { AdminConfigEntity } from './entities/admin-config.entity';
import { SeedDatabase } from './seeders/seed.database';
import { UserEntity } from './entities/user.entity';
import { UserSessionEntity } from './entities/user-session.entity';

const repositories = [
  AdminConfigRepository,
  UserRepository,
  UserSessionRepository,
];

const services = [];

const entities = [AdminConfigEntity, UserEntity, UserSessionEntity];

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
