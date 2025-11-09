import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessModule } from '../business/business.module';
import { GameGateway } from './game.gateway';
import { WebSocketGateway } from './websocket.gateway';

const providers = [GameGateway, WebSocketGateway];

@Module({
  imports: [BusinessModule, ConfigModule],
  providers,
  exports: providers,
})
export class WebSocketModule {}