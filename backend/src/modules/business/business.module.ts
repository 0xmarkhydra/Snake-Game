import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import {
  AuthService,
  GameService,
  OpenAIService,
  VipGameService,
  WalletService,
} from './services';

const services = [
  AuthService,
  GameService,
  OpenAIService,
  WalletService,
  VipGameService,
];

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.jwt_secret_key'),
        signOptions: {
          expiresIn: configService.get<number>(
            'auth.jwt.access_token_lifetime',
          ),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [...services],
  providers: [...services],
})
export class BusinessModule {}
