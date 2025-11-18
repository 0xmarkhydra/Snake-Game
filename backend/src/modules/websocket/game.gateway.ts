import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Room, Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Server as HttpServer } from 'http';
import { JwtService } from '@nestjs/jwt';
import { GameService, VipGameService } from '../business/services';
import { FreeGameRoom, VipGameRoom } from '../game/rooms';

type RoomConstructor<T extends Room = Room> = new (...args: any[]) => T;

@Injectable()
export class GameGateway implements OnModuleDestroy {
  private server: Server | null = null;
  private httpServer: HttpServer | null = null;

  constructor(
    private readonly gameService: GameService,
    private readonly vipGameService: VipGameService,
    private readonly jwtService: JwtService,
    @InjectPinoLogger(GameGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  attachServer(gameServer: Server): void {
    this.logger.info('Attaching Colyseus server through GameGateway.');
    this.gameService.attachServer(gameServer);
  }

  registerRoom<T extends Room>(
    roomName: string,
    roomClass: RoomConstructor<T>,
    defaultOptions?: Record<string, unknown>,
  ): void {
    this.logger.info({ roomName }, 'Registering room via GameGateway.');
    this.gameService.registerRoom(roomName, roomClass, defaultOptions);
  }

  hasRegisteredRoom(roomName: string): boolean {
    return this.gameService.hasRegisteredRoom(roomName);
  }

  initialize(httpServer: HttpServer): void {
    if (this.server) {
      this.logger.warn('Game server already initialized, skipping bootstrap.');
      return;
    }

    const gameServer = new Server({
      transport: new WebSocketTransport({
        server: httpServer,
      }),
    });

    this.httpServer = httpServer;
    this.server = gameServer;

    this.attachServer(gameServer);
    this.registerDefaultRooms();
    this.logger.info('Colyseus server attached to existing HTTP server.');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info(
      'Shutting down GameGateway and underlying Colyseus server.',
    );
    await this.gameService.shutdown();
    this.server = null;
    this.httpServer = null;
  }

  private registerDefaultRooms(): void {
    if (!this.hasRegisteredRoom('snake_game')) {
      this.registerRoom('snake_game', FreeGameRoom);
    }

    if (!this.hasRegisteredRoom('snake_game_vip')) {
      VipGameRoom.configure({
        vipGameService: this.vipGameService,
        jwtService: this.jwtService,
      });
      this.registerRoom('snake_game_vip', VipGameRoom);
    }
  }
}
