import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BusinessModule } from '../business/business.module';
import { GameGateway } from './game.gateway';
import { WebSocketGateway } from './websocket.gateway';

const providers = [GameGateway, WebSocketGateway];

@Module({
  imports: [
    BusinessModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
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
  providers,
  exports: providers,
})
export class WebSocketModule {}
