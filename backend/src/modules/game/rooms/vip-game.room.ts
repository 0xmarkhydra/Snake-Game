import { Client } from '@colyseus/core';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { FreeGameRoom } from './free-game.room';
import { Player } from './schema';
import { VipGameService } from '@/business/services';
import { VipRoomConfigEntity } from '@/database/entities';

type VipGameRoomDependencies = {
  vipGameService: VipGameService;
  jwtService: JwtService;
};

type SessionInfo = {
  userId: string;
  ticketId: string;
  credit: number;
};

export class VipGameRoom extends FreeGameRoom {
  private static vipGameService: VipGameService | null = null;
  private static jwtService: JwtService | null = null;

  private sessionInfo = new Map<string, SessionInfo>();
  private config?: VipRoomConfigEntity;

  static configure(dependencies: VipGameRoomDependencies): void {
    VipGameRoom.vipGameService = dependencies.vipGameService;
    VipGameRoom.jwtService = dependencies.jwtService;
  }

  private static ensureDependencies(): void {
    if (!VipGameRoom.vipGameService || !VipGameRoom.jwtService) {
      throw new UnauthorizedException(
        'VIP game dependencies are not configured',
      );
    }
  }

  async onCreate(options?: unknown): Promise<void> {
    void options;

    VipGameRoom.ensureDependencies();
    try {
      this.config = await VipGameServiceUtils.getConfig(
        VipGameRoom.vipGameService!,
      );
      this.maxClients = this.config.maxClients;
      this.tickRate = VipGameServiceUtils.toTickInterval(this.config.tickRate);
    } catch (error) {
      console.error('⚠️ Failed to load VIP config, using defaults', error);
    }

    super.onCreate();
    this.state.tickRate = this.tickRate;
  }

  async onAuth(
    client: Client,
    options: Record<string, unknown>,
  ): Promise<boolean> {
    VipGameRoom.ensureDependencies();
    const token =
      (options?.jwt as string) ??
      (options?.accessToken as string) ??
      (options?.token as string);
    const ticketId = options?.ticketId as string | undefined;

    if (!token || !ticketId) {
      throw new Error('Missing authentication token or ticket');
    }

    try {
      const payload = await VipGameRoom.jwtService!.verifyAsync<{
        sub: string;
        walletAddress?: string;
      }>(token);

      if (!payload?.sub) {
        throw new Error('Invalid JWT payload');
      }

      const validation = await VipGameRoom.vipGameService!.validateTicket(
        ticketId,
        payload.sub,
      );

      const credit = VipGameServiceUtils.parseCredit(validation.credit);

      this.sessionInfo.set(client.sessionId, {
        userId: payload.sub,
        ticketId,
        credit,
      });

      (client as Client & { authData?: SessionInfo }).authData = {
        userId: payload.sub,
        ticketId,
        credit,
      };

      return true;
    } catch (error) {
      console.error('❌ VIP authentication failed', error);
      throw new Error('Unauthorized to join VIP room');
    }
  }

  async onJoin(
    client: Client,
    options: { name: string; skinId?: number },
  ): Promise<void> {
    await super.onJoin(client, options);

    const session = this.sessionInfo.get(client.sessionId);
    if (!session) {
      client.leave(4003, 'VIP session not found');
      return;
    }

    try {
      const consumeResult = await VipGameRoom.vipGameService!.consumeTicket(
        session.ticketId,
        this.roomId,
      );

      session.credit = VipGameServiceUtils.parseCredit(consumeResult.credit);

      this.updatePlayerCredit(client.sessionId, session.credit);
      this.broadcast('vip:credit-updated', {
        playerId: client.sessionId,
        credit: session.credit,
      });

      client.send(
        'vip:config',
        VipGameServiceUtils.buildConfigPayload(this.config),
      );
    } catch (error) {
      console.error('❌ Failed to consume VIP ticket', error);
      client.send('vip:error', {
        message: 'Unable to consume VIP ticket. Please try again later.',
      });
      this.sessionInfo.delete(client.sessionId);
      client.leave(4010, 'Failed to consume VIP ticket');
    }
  }

  onLeave(client: Client): void {
    super.onLeave(client);
    this.sessionInfo.delete(client.sessionId);
  }

  protected respawnPlayer(client: Client): void {
    const session = this.sessionInfo.get(client.sessionId);
    if (!session) {
      super.respawnPlayer(client);
      return;
    }

    void this.processRespawn(client, session);
  }

  protected afterKillProcessed(
    victim: Player,
    killer?: Player,
    context?: { reason?: string },
  ): void {
    if (!killer) {
      return;
    }

    const killerSession = this.sessionInfo.get(killer.id);
    const victimSession = this.sessionInfo.get(victim.id);

    if (!killerSession || !victimSession) {
      return;
    }

    void this.processKillReward(killerSession, victimSession, context?.reason);
  }

  private async processKillReward(
    killerSession: SessionInfo,
    victimSession: SessionInfo,
    reason?: string,
  ): Promise<void> {
    try {
      const result = await VipGameRoom.vipGameService!.processKillReward({
        killerTicketId: killerSession.ticketId,
        victimTicketId: victimSession.ticketId,
        killReference: `kill-${uuid()}`,
        roomInstanceId: this.roomId,
      });

      killerSession.credit = VipGameServiceUtils.parseCredit(
        result.killerCredit,
      );
      victimSession.credit = VipGameServiceUtils.parseCredit(
        result.victimCredit,
      );

      this.updatePlayerCreditByTicket(
        killerSession.ticketId,
        killerSession.credit,
      );
      this.updatePlayerCreditByTicket(
        victimSession.ticketId,
        victimSession.credit,
      );

      const killerId = this.findPlayerIdByTicket(killerSession.ticketId);
      const victimId = this.findPlayerIdByTicket(victimSession.ticketId);

      if (killerId) {
        this.broadcast('vip:credit-updated', {
          playerId: killerId,
          credit: killerSession.credit,
        });
      }

      if (victimId) {
        this.broadcast('vip:credit-updated', {
          playerId: victimId,
          credit: victimSession.credit,
        });
      }

      if (!result.alreadyProcessed && killerId && victimId) {
        this.broadcast('vip:reward', {
          killerId,
          victimId,
          rewardAmount: VipGameServiceUtils.parseCredit(result.rewardAmount),
          feeAmount: VipGameServiceUtils.parseCredit(result.feeAmount),
          reason,
        });
      }
    } catch (error) {
      console.error('❌ Failed to process VIP kill reward', error);
      this.broadcast('vip:error', {
        message: 'Reward processing failed. Please continue playing.',
      });
    }
  }

  private async processRespawn(
    client: Client,
    session: SessionInfo,
  ): Promise<void> {
    try {
      const result = await VipGameRoom.vipGameService!.processRespawn(
        session.ticketId,
      );
      session.credit = VipGameServiceUtils.parseCredit(result.credit);

      this.updatePlayerCredit(client.sessionId, session.credit);
      this.broadcast('vip:credit-updated', {
        playerId: client.sessionId,
        credit: session.credit,
      });

      super.respawnPlayer(client);
    } catch (error) {
      console.error('❌ Respawn denied due to insufficient credit', error);
      client.send('vip:error', {
        message: 'Insufficient credit to respawn. Please acquire more credit.',
      });
    }
  }

  private updatePlayerCredit(sessionId: string, credit: number): void {
    const player = this.state.players.get(sessionId);
    if (player) {
      player.credit = credit;
    }
  }

  private updatePlayerCreditByTicket(ticketId: string, credit: number): void {
    const sessionId = this.findPlayerIdByTicket(ticketId);
    if (sessionId) {
      this.updatePlayerCredit(sessionId, credit);
    }
  }

  private findPlayerIdByTicket(ticketId: string): string | undefined {
    for (const [sessionId, info] of this.sessionInfo.entries()) {
      if (info.ticketId === ticketId) {
        return sessionId;
      }
    }
    return undefined;
  }
}

class VipGameServiceUtils {
  static async getConfig(
    service: VipGameService,
  ): Promise<VipRoomConfigEntity> {
    return service.getRoomConfig();
  }

  static toTickInterval(tickRate: number): number {
    if (!Number.isFinite(tickRate) || tickRate <= 0) {
      return 16;
    }
    return Math.max(1, Math.round(1000 / tickRate));
  }

  static parseCredit(value: string | number): number {
    const numeric = typeof value === 'string' ? parseFloat(value) : value;
    return Number.isFinite(numeric) ? Number(numeric) : 0;
  }

  static buildConfigPayload(
    config?: VipRoomConfigEntity,
  ): Record<string, unknown> {
    if (!config) {
      return {};
    }
    return {
      entryFee: this.parseCredit(config.entryFee),
      rewardRatePlayer: this.parseCredit(config.rewardRatePlayer),
      rewardRateTreasury: this.parseCredit(config.rewardRateTreasury),
      respawnCost: this.parseCredit(config.respawnCost),
      maxClients: config.maxClients,
      tickRate: config.tickRate,
      metadata: config.metadata ?? {},
    };
  }
}
