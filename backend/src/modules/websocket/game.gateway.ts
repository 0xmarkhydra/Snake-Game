import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Room, Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer, Server as HttpServer } from 'http';
import { GameService } from '../business/services';
import { FreeGameRoom } from '../game/rooms';

type RoomConstructor<T extends Room = Room> = new (...args: any[]) => T;

@Injectable()
export class GameGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private server: Server | null = null;

  constructor(
    private readonly gameService: GameService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(GameGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  attachServer(gameServer: Server): void {
    this.logger.info('Attaching Colyseus server through GameGateway.');
    this.gameService.attachServer(gameServer);
  }

  registerRoom<T extends Room>(roomName: string, roomClass: RoomConstructor<T>, defaultOptions?: Record<string, unknown>): void {
    this.logger.info({ roomName }, 'Registering room via GameGateway.');
    this.gameService.registerRoom(roomName, roomClass, defaultOptions);
  }

  hasRegisteredRoom(roomName: string): boolean {
    return this.gameService.hasRegisteredRoom(roomName);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.server) {
      this.logger.warn('Game server already initialized, skipping bootstrap.');
      return;
    }

    const port = Number(this.configService.get('COLYSEUS_PORT') ?? 2567);
    const host = this.configService.get<string>('COLYSEUS_HOST') ?? '0.0.0.0';

    const httpServer = createServer();

    const gameServer = new Server({
      transport: new WebSocketTransport({
        server: httpServer,
      }),
    });

    this.server = gameServer;

    this.attachServer(gameServer);
    this.registerDefaultRooms();

    await gameServer.listen(port, host);
    this.logger.info(`Colyseus server listening on ws://${host}:${port}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info('Shutting down GameGateway and underlying Colyseus server.');
    await this.gameService.shutdown();
    const httpServer = this.server?.transport?.server as HttpServer | undefined;

    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  }

  private registerDefaultRooms(): void {
    if (!this.hasRegisteredRoom('snake_game')) {
      this.registerRoom('snake_game', FreeGameRoom);
    }
  }
}

