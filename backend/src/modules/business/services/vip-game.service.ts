import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  FindOneOptions,
  Repository,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  KillLogEntity,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  VipRoomConfigEntity,
  VipRoomType,
  VipTicketEntity,
  VipTicketStatus,
  WalletBalanceEntity,
} from '@/database/entities';
import {
  KillLogRepository,
  TransactionRepository,
  UserRepository,
  VipRoomConfigRepository,
  VipTicketRepository,
  WalletBalanceRepository,
} from '@/database/repositories';
import { ReferralService } from './referral.service';

export type VipAccessCheckResult = {
  canJoin: boolean;
  credit: string;
  ticket?: VipTicketEntity;
  config?: VipRoomConfigEntity;
  reason?: string;
};

export type VipTicketValidationResult = {
  ticket: VipTicketEntity;
  config: VipRoomConfigEntity;
  credit: string;
};

export type VipTicketConsumptionResult = {
  credit: string;
  ticket: VipTicketEntity;
  transaction?: TransactionEntity | null;
};

export type VipKillRewardResult = {
  killerCredit: string;
  victimCredit: string;
  rewardAmount: string;
  feeAmount: string;
  killLog: KillLogEntity;
  alreadyProcessed: boolean;
};

export type VipRespawnResult = {
  credit: string;
  cost: string;
  transaction?: TransactionEntity;
};

export type VipWallCollisionPenaltyResult = {
  credit: string;
  penaltyAmount: string;
  killLog: KillLogEntity;
  transaction?: TransactionEntity;
};

type ProcessKillRewardParams = {
  killerTicketId: string;
  victimTicketId: string;
  killReference: string;
  roomInstanceId: string;
};

@Injectable()
export class VipGameService {
  private readonly tokenDecimals: number;
  private readonly defaultEntryFee: number;
  private readonly defaultRewardPlayer: number;
  private readonly defaultRewardTreasury: number;
  private readonly defaultRespawnCost: number;
  private readonly defaultMaxClients: number;
  private readonly defaultTickRate: number;

  constructor(
    private readonly vipRoomConfigRepository: VipRoomConfigRepository,
    private readonly vipTicketRepository: VipTicketRepository,
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly userRepository: UserRepository,
    private readonly killLogRepository: KillLogRepository,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly referralService: ReferralService,
    @InjectPinoLogger(VipGameService.name)
    private readonly logger: PinoLogger,
  ) {
    this.tokenDecimals =
      Number(this.configService.get<number>('wallet.tokenDecimals')) || 6;
    this.defaultEntryFee =
      Number(this.configService.get<number>('vip.entryFee')) || 1;
    this.defaultRewardPlayer =
      Number(this.configService.get<number>('vip.rewardRatePlayer')) || 0.9;
    this.defaultRewardTreasury =
      Number(this.configService.get<number>('vip.rewardRateTreasury')) || 0.1;
    this.defaultRespawnCost =
      Number(this.configService.get<number>('vip.respawnCost')) || 0;
    this.defaultMaxClients =
      Number(this.configService.get<number>('vip.maxClients')) || 20;
    this.defaultTickRate =
      Number(this.configService.get<number>('vip.tickRate')) || 60;
  }

  async getRoomConfig(
    roomType: VipRoomType = VipRoomType.SNAKE_VIP,
  ): Promise<VipRoomConfigEntity> {
    try {
      return await this.getActiveConfig(roomType);
    } catch (error) {
      this.logger.error(error, 'Failed to load VIP room configuration');
      throw new InternalServerErrorException(
        'Unable to load VIP room configuration',
      );
    }
  }

  async checkAccess(
    userId: string,
    roomType: VipRoomType = VipRoomType.SNAKE_VIP,
  ): Promise<VipAccessCheckResult> {
    try {
      const config = await this.getActiveConfig(roomType);
      const { balance } = await this.getOrCreateWalletBalance(userId);
      const available = this.toNumber(balance.availableAmount);
      const entryFee = this.toNumber(config.entryFee);

      if (available < entryFee) {
        return {
          canJoin: false,
          credit: balance.availableAmount,
          reason: 'Insufficient credit to join VIP room',
          config,
        };
      }

      const ticket = await this.vipTicketRepository.save(
        this.vipTicketRepository.create({
          user: balance.user,
          roomType,
          entryFee: config.entryFee,
          ticketCode: this.generateTicketCode(),
          metadata: {
            issuedAt: new Date().toISOString(),
            issuedBy: 'VipGameService',
          },
        }),
      );

      return {
        canJoin: true,
        credit: balance.availableAmount,
        ticket,
        config,
      };
    } catch (error) {
      this.logger.error(error, 'Failed to check VIP access');
      throw new InternalServerErrorException('Unable to check VIP access');
    }
  }

  async validateTicket(
    ticketId: string,
    expectedUserId?: string,
  ): Promise<VipTicketValidationResult> {
    try {
      const ticket = await this.findTicketOrThrow({
        where: { id: ticketId },
        relations: ['user'],
      });

      if (ticket.status !== VipTicketStatus.ISSUED) {
        throw new BadRequestException('Ticket has already been consumed');
      }

      if (expectedUserId && ticket.user.id !== expectedUserId) {
        throw new UnauthorizedException('Ticket does not belong to the user');
      }

      const config = await this.getActiveConfig(ticket.roomType);
      const { balance } = await this.getOrCreateWalletBalance(ticket.user.id);

      return {
        ticket,
        config,
        credit: balance.availableAmount,
      };
    } catch (error) {
      this.logger.error(error, 'Failed to validate VIP ticket');
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to validate ticket');
    }
  }

  async consumeTicket(
    ticketId: string,
    roomInstanceId: string,
  ): Promise<VipTicketConsumptionResult> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const ticketRepository = manager.getRepository(VipTicketEntity);
        const walletRepository = manager.getRepository(WalletBalanceEntity);
        const ticket = await this.findTicketWithLock(ticketId, manager);

        if (ticket.status !== VipTicketStatus.ISSUED) {
          throw new BadRequestException('Ticket cannot be consumed twice');
        }

        const config = await this.getActiveConfig(ticket.roomType, manager);
        const { balance } = await this.getOrCreateWalletBalance(
          ticket.user.id,
          walletRepository,
          true,
        );

        const entryFee = this.toNumber(config.entryFee);
        if (this.toNumber(balance.availableAmount) < entryFee) {
          throw new UnauthorizedException(
            'Insufficient credit to consume ticket',
          );
        }

        if (entryFee > 0) {
          balance.lockedAmount = this.formatAmount(
            this.toNumber(balance.lockedAmount) + entryFee,
          );
          await walletRepository.save(balance);
        }

        ticket.status = VipTicketStatus.CONSUMED;
        ticket.roomInstanceId = roomInstanceId;
        ticket.consumedAt = new Date();

        const savedTicket = await ticketRepository.save(ticket);

        return {
          credit: balance.availableAmount,
          ticket: savedTicket,
        };
      });
    } catch (error) {
      this.logger.error(error, 'Failed to consume VIP ticket');
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to consume ticket');
    }
  }

  async processKillReward(
    params: ProcessKillRewardParams,
  ): Promise<VipKillRewardResult> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const killLogRepository = manager.getRepository(KillLogEntity);
        const ticketRepository = manager.getRepository(VipTicketEntity);
        const walletRepository = manager.getRepository(WalletBalanceEntity);
        const transactionRepository =
          manager.getRepository(TransactionEntity);

        const existingLog = await killLogRepository.findOne({
          where: { killReference: params.killReference },
          relations: [
            'killerTicket',
            'killerTicket.user',
            'victimTicket',
            'victimTicket.user',
          ],
        });

        if (existingLog) {
          const killerCredit = await this.getWalletBalanceAmount(
            existingLog.killerTicket?.user,
            walletRepository,
          );
          const victimCredit = await this.getWalletBalanceAmount(
            existingLog.victimTicket?.user,
            walletRepository,
          );
          return {
            killerCredit,
            victimCredit,
            rewardAmount: existingLog.rewardAmount,
            feeAmount: existingLog.feeAmount,
            killLog: existingLog,
            alreadyProcessed: true,
          };
        }

        const killerTicket = await this.findTicketWithLock(
          params.killerTicketId,
          manager,
        );
        const victimTicket = await this.findTicketWithLock(
          params.victimTicketId,
          manager,
        );

        const config = await this.getActiveConfig(
          killerTicket.roomType,
          manager,
        );

        const rewardAmount = this.toNumber(config.rewardRatePlayer);
        const feeAmount = this.toNumber(config.rewardRateTreasury);
        const totalDebit = rewardAmount + feeAmount;

        const killerBalanceResult = await this.getOrCreateWalletBalance(
          killerTicket.user.id,
          walletRepository,
          true,
        );
        const victimBalanceResult = await this.getOrCreateWalletBalance(
          victimTicket.user.id,
          walletRepository,
          true,
        );

        if (
          this.toNumber(victimBalanceResult.balance.availableAmount) <
          totalDebit
        ) {
          throw new UnauthorizedException(
            'Victim does not have sufficient credit to cover reward',
          );
        }

        killerBalanceResult.balance.availableAmount = this.formatAmount(
          this.toNumber(killerBalanceResult.balance.availableAmount) +
            rewardAmount,
        );
        victimBalanceResult.balance.availableAmount = this.formatAmount(
          this.toNumber(victimBalanceResult.balance.availableAmount) -
            totalDebit,
        );

        const killLog = await killLogRepository.save(
          killLogRepository.create({
            roomInstanceId: params.roomInstanceId,
            roomType: killerTicket.roomType,
            killerUser: killerTicket.user,
            victimUser: victimTicket.user,
            killerTicket,
            victimTicket,
            rewardAmount: this.formatAmount(rewardAmount),
            feeAmount: this.formatAmount(feeAmount),
            killReference: params.killReference,
            metadata: {
              processedAt: new Date().toISOString(),
              source: 'vip-kill-reward',
            },
          }),
        );

        const killerTransaction = transactionRepository.create({
          user: killerTicket.user,
          type: TransactionType.REWARD,
          status: TransactionStatus.CONFIRMED,
          amount: this.formatAmount(rewardAmount),
          feeAmount: this.formatAmount(0),
          referenceId: killLog.id,
          metadata: {
            source: 'vip-kill-reward',
            killReference: params.killReference,
            opponentTicketId: victimTicket.id,
            roomInstanceId: params.roomInstanceId,
          },
          processedAt: new Date(),
          occurredAt: new Date(),
        });

        const victimTransaction = transactionRepository.create({
          user: victimTicket.user,
          type: TransactionType.PENALTY,
          status: TransactionStatus.CONFIRMED,
          amount: this.formatAmount(totalDebit),
          feeAmount: this.formatAmount(feeAmount),
          referenceId: killLog.id,
          metadata: {
            source: 'vip-kill-reward',
            killReference: params.killReference,
            opponentTicketId: killerTicket.id,
            roomInstanceId: params.roomInstanceId,
          },
          processedAt: new Date(),
          occurredAt: new Date(),
        });

        const savedKillerTransaction =
          await transactionRepository.save(killerTransaction);
        const savedVictimTransaction =
          await transactionRepository.save(victimTransaction);

        killerBalanceResult.balance.lastTransactionId =
          savedKillerTransaction.id;
        victimBalanceResult.balance.lastTransactionId =
          savedVictimTransaction.id;

        await walletRepository.save(killerBalanceResult.balance);
        await walletRepository.save(victimBalanceResult.balance);

        // Process referral commission after transaction is committed
        // Load users with referredById to check for referrers
        const killerUser = await this.userRepository.findOne({
          where: { id: killerTicket.user.id },
          select: ['id', 'referredById'],
        });
        const victimUser = await this.userRepository.findOne({
          where: { id: victimTicket.user.id },
          select: ['id', 'referredById'],
        });

        // Check if killer has referrer
        if (killerUser?.referredById) {
          try {
            await this.referralService.processGameCommission({
              refereeId: killerUser.id,
              referrerId: killerUser.referredById,
              feeAmount: this.formatAmount(feeAmount),
              killLogId: killLog.id,
              actionType: 'kill',
              metadata: {
                reward_amount: this.formatAmount(rewardAmount),
                kill_reference: params.killReference,
              },
            });
          } catch (error) {
            // Log error but don't fail the kill reward processing
            this.logger.warn(
              error,
              'Failed to process referral commission for killer',
            );
          }
        }

        // Check if victim has referrer
        if (victimUser?.referredById) {
          try {
            await this.referralService.processGameCommission({
              refereeId: victimUser.id,
              referrerId: victimUser.referredById,
              feeAmount: this.formatAmount(feeAmount),
              killLogId: killLog.id,
              actionType: 'death',
              metadata: {
                penalty_amount: this.formatAmount(totalDebit),
                kill_reference: params.killReference,
              },
            });
          } catch (error) {
            // Log error but don't fail the kill reward processing
            this.logger.warn(
              error,
              'Failed to process referral commission for victim',
            );
          }
        }

        return {
          killerCredit: killerBalanceResult.balance.availableAmount,
          victimCredit: victimBalanceResult.balance.availableAmount,
          rewardAmount: this.formatAmount(rewardAmount),
          feeAmount: this.formatAmount(feeAmount),
          killLog,
          alreadyProcessed: false,
        };
      });
    } catch (error) {
      this.logger.error(error, 'Failed to process VIP kill reward');
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to process kill reward');
    }
  }

  async processWallCollisionPenalty(
    ticketId: string,
    roomInstanceId: string,
  ): Promise<VipWallCollisionPenaltyResult> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const killLogRepository = manager.getRepository(KillLogEntity);
        const ticketRepository = manager.getRepository(VipTicketEntity);
        const walletRepository = manager.getRepository(WalletBalanceEntity);
        const transactionRepository =
          manager.getRepository(TransactionEntity);

        const ticket = await this.findTicketWithLock(ticketId, manager);

        const config = await this.getActiveConfig(ticket.roomType, manager);

        // Use same penalty as being killed (rewardRatePlayer + rewardRateTreasury)
        const penaltyAmount = this.toNumber(config.rewardRatePlayer);
        const feeAmount = this.toNumber(config.rewardRateTreasury);
        const totalPenalty = penaltyAmount + feeAmount;

        const { balance } = await this.getOrCreateWalletBalance(
          ticket.user.id,
          walletRepository,
          true,
        );

        const currentCredit = this.toNumber(balance.availableAmount);

        if (currentCredit < totalPenalty) {
          throw new UnauthorizedException(
            'Insufficient credit to cover wall collision penalty',
          );
        }

        balance.availableAmount = this.formatAmount(
          currentCredit - totalPenalty,
        );

        // Create kill log for wall collision (no killer)
        const killReference = `wall-collision-${uuid()}`;
        const killLog = await killLogRepository.save(
          killLogRepository.create({
            roomInstanceId,
            roomType: ticket.roomType,
            killerUser: null, // No killer for wall collision
            victimUser: ticket.user,
            killerTicket: null, // No killer ticket
            victimTicket: ticket,
            rewardAmount: this.formatAmount(0), // No reward for wall collision
            feeAmount: this.formatAmount(feeAmount),
            killReference,
            metadata: {
              processedAt: new Date().toISOString(),
              source: 'vip-wall-collision',
              reason: 'wall_collision',
            },
          }),
        );

        const transaction = transactionRepository.create({
          user: ticket.user,
          type: TransactionType.PENALTY,
          status: TransactionStatus.CONFIRMED,
          amount: this.formatAmount(totalPenalty),
          feeAmount: this.formatAmount(feeAmount),
          referenceId: killLog.id,
          metadata: {
            source: 'vip-wall-collision',
            roomInstanceId,
            ticketId: ticket.id,
            killReference,
          },
          processedAt: new Date(),
          occurredAt: new Date(),
        });

        const savedTransaction = await transactionRepository.save(transaction);

        balance.lastTransactionId = savedTransaction.id;

        await walletRepository.save(balance);

        // Process referral commission after transaction is committed
        // Check if victim has referrer
        const user = await this.userRepository.findOne({
          where: { id: ticket.user.id },
          select: ['id', 'referredById'],
        });

        if (user?.referredById) {
          try {
            await this.referralService.processGameCommission({
              refereeId: ticket.user.id,
              referrerId: user.referredById,
              feeAmount: this.formatAmount(feeAmount),
              killLogId: killLog.id,
              actionType: 'death',
              metadata: {
                penalty_amount: this.formatAmount(totalPenalty),
                kill_reference: killReference,
                reason: 'wall_collision',
              },
            });
          } catch (error) {
            // Log error but don't fail the penalty processing
            this.logger.warn(
              error,
              'Failed to process referral commission for wall collision',
            );
          }
        }

        return {
          credit: balance.availableAmount,
          penaltyAmount: this.formatAmount(totalPenalty),
          killLog,
          transaction: savedTransaction,
        };
      });
    } catch (error) {
      this.logger.error(error, 'Failed to process VIP wall collision penalty');
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Unable to process wall collision penalty',
      );
    }
  }

  async processRespawn(ticketId: string): Promise<VipRespawnResult> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const ticketRepository = manager.getRepository(VipTicketEntity);
        const walletRepository = manager.getRepository(WalletBalanceEntity);

        const ticket = await this.findTicketWithLock(ticketId, manager);

        const config = await this.getActiveConfig(ticket.roomType, manager);
        const cost = this.toNumber(config.respawnCost);

        const { balance } = await this.getOrCreateWalletBalance(
          ticket.user.id,
          walletRepository,
          true,
        );

        const currentCredit = this.toNumber(balance.availableAmount);
        const entryRequirement = this.toNumber(config.entryFee);

        if (currentCredit < entryRequirement) {
          throw new UnauthorizedException(
            'Insufficient credit for respawn',
          );
        }

        if (currentCredit < cost) {
          throw new UnauthorizedException(
            'Insufficient credit for respawn',
          );
        }

        if (cost > 0) {
          balance.availableAmount = this.formatAmount(currentCredit - cost);

          await walletRepository.save(balance);
        }

        return {
          credit: balance.availableAmount,
          cost: this.formatAmount(cost),
        };
      });
    } catch (error) {
      this.logger.error(error, 'Failed to process VIP respawn');
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to process respawn');
    }
  }

  private async getActiveConfig(
    roomType: VipRoomType,
    manager = this.dataSource.manager,
  ): Promise<VipRoomConfigEntity> {
    return this.ensureVipConfig(roomType, manager);
  }

  private async getOrCreateWalletBalance(
    userId: string,
    repository: Repository<WalletBalanceEntity> = this.walletBalanceRepository,
    lock = false,
  ): Promise<{ balance: WalletBalanceEntity; user: UserEntity }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const options: FindOneOptions<WalletBalanceEntity> = {
      where: { user: { id: userId } },
      relations: ['user'],
    };

    if (lock) {
      options.lock = { mode: 'pessimistic_write' };
    }

    let balance = await repository.findOne(options);
    if (!balance) {
      balance = repository.create({
        user,
        availableAmount: this.formatAmount(0),
        lockedAmount: this.formatAmount(0),
      });
      balance = await repository.save(balance);
    }

    return { balance, user };
  }

  private async findTicketOrThrow(
    options: FindOneOptions<VipTicketEntity>,
    repository: Repository<VipTicketEntity> = this.vipTicketRepository,
    lock = false,
  ): Promise<VipTicketEntity> {
    if (lock) {
      options.lock = { mode: 'pessimistic_write' };
    }

    const ticket = await repository.findOne(options);
    if (!ticket) {
      throw new NotFoundException('VIP ticket not found');
    }
    return ticket;
  }

  private async findTicketWithLock(
    ticketId: string,
    manager: EntityManager,
  ): Promise<VipTicketEntity> {
    const repository = manager.getRepository(VipTicketEntity);
    const ticket = await repository
      .createQueryBuilder('ticket')
      .setLock('pessimistic_write')
      .innerJoinAndSelect('ticket.user', 'user')
      .where('ticket.id = :id', { id: ticketId })
      .getOne();

    if (!ticket) {
      throw new NotFoundException('VIP ticket not found');
    }

    return ticket;
  }

  private async getWalletBalanceAmount(
    user: UserEntity | undefined,
    repository: Repository<WalletBalanceEntity>,
  ): Promise<string> {
    if (!user) {
      return this.formatAmount(0);
    }

    const balance = await repository.findOne({
      where: { user: { id: user.id } },
    });

    return balance?.availableAmount ?? this.formatAmount(0);
  }

  private formatAmount(value: number): string {
    return value.toFixed(this.tokenDecimals);
  }

  private async ensureVipConfig(
    roomType: VipRoomType,
    manager?: EntityManager,
  ): Promise<VipRoomConfigEntity> {
    const repository = manager
      ? manager.getRepository(VipRoomConfigEntity)
      : this.vipRoomConfigRepository;

    let config = await repository.findOne({
      where: { roomType, isActive: true },
    });

    if (config) {
      return config;
    }

    config = repository.create({
      roomType,
      entryFee: this.formatAmount(this.defaultEntryFee),
      rewardRatePlayer: this.formatAmount(this.defaultRewardPlayer),
      rewardRateTreasury: this.formatAmount(this.defaultRewardTreasury),
      respawnCost: this.formatAmount(this.defaultRespawnCost),
      maxClients: this.defaultMaxClients,
      tickRate: this.defaultTickRate,
      isActive: true,
      metadata: {
        autoGenerated: true,
        generatedAt: new Date().toISOString(),
      },
    });

    return repository.save(config);
  }

  private toNumber(value: string | number | null | undefined): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private generateTicketCode(): string {
    return uuid();
  }
}
