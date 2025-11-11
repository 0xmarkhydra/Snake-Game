import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Room, Server } from 'colyseus';

type RoomConstructor<T extends Room = Room> = new (...args: any[]) => T;

@Injectable()
export class GameService {
  private gameServer: Server | null = null;
  private readonly registeredRooms: Set<string> = new Set();

  constructor(
    @InjectPinoLogger(GameService.name)
    private readonly logger: PinoLogger,
  ) {}

  attachServer(gameServer: Server): void {
    if (this.gameServer) {
      this.logger.warn(
        'Game server is already attached. Skipping re-attachment.',
      );
      return;
    }

    this.logger.info('Attaching Colyseus game server instance.');
    this.gameServer = gameServer;
  }

  registerRoom<T extends Room>(
    roomName: string,
    roomClass: RoomConstructor<T>,
    defaultOptions?: Record<string, unknown>,
  ): void {
    const server = this.ensureGameServer();

    if (this.registeredRooms.has(roomName)) {
      this.logger.warn(
        { roomName },
        'Room has already been registered. Skipping duplicate definition.',
      );
      return;
    }

    this.logger.info({ roomName }, 'Registering Colyseus room handler.');
    server.define(roomName, roomClass, defaultOptions);
    this.registeredRooms.add(roomName);
  }

  hasRegisteredRoom(roomName: string): boolean {
    return this.registeredRooms.has(roomName);
  }

  async shutdown(): Promise<void> {
    if (!this.gameServer) {
      this.logger.warn('No game server instance found during shutdown.');
      return;
    }

    if (typeof this.gameServer.gracefullyShutdown === 'function') {
      this.logger.info('Gracefully shutting down Colyseus game server.');
      await this.gameServer.gracefullyShutdown();
    }

    this.registeredRooms.clear();
    this.gameServer = null;
    this.logger.info('Colyseus game server shutdown completed.');
  }

  private ensureGameServer(): Server {
    if (!this.gameServer) {
      this.logger.error(
        'Attempted to access game server before it was attached.',
      );
      throw new Error('Game server has not been attached yet.');
    }

    return this.gameServer;
  }
}
