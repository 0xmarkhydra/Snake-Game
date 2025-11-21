import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  ReferralRewardRepository,
  TransactionRepository,
  UserRepository,
  WalletBalanceRepository,
} from '@/database/repositories';
import {
  ReferralRewardEntity,
  ReferralRewardStatus,
  ReferralRewardType,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  WalletBalanceEntity,
} from '@/database/entities';

type ProcessGameCommissionParams = {
  refereeId: string;
  referrerId: string;
  feeAmount: string;
  killLogId: string;
  actionType: 'kill' | 'death';
  metadata?: Record<string, unknown>;
};

@Injectable()
export class ReferralService {
  private readonly tokenDecimals: number;
  private readonly killCommissionRate: number;
  private readonly deathCommissionRate: number;
  private readonly commissionCapPerUser?: number;
  private readonly referralCodeLength: number;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly referralRewardRepository: ReferralRewardRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.tokenDecimals =
      Number(this.configService.get<number>('wallet.tokenDecimals')) || 6;
    this.killCommissionRate =
      Number(
        this.configService.get<number>('referral.gameKillCommissionRate'),
      ) || 0.02;
    this.deathCommissionRate =
      Number(
        this.configService.get<number>('referral.gameDeathCommissionRate'),
      ) || 0.01;
    this.commissionCapPerUser = this.configService.get<number>(
      'referral.commissionCapPerUser',
    );
    this.referralCodeLength =
      Number(this.configService.get<number>('referral.codeLength')) || 8;
  }

  async generateUniqueReferralCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = this.generateReferralCode();
      const existing = await this.userRepository.findOne({
        where: { referralCode: code },
      });

      if (!existing) {
        return code;
      }

      attempts++;
    }

    throw new InternalServerErrorException(
      'Failed to generate unique referral code',
    );
  }

  async validateAndGetReferrer(
    referralCode: string,
    walletAddress?: string,
  ): Promise<UserEntity | null> {
    if (!referralCode) {
      return null;
    }

    // Normalize referral code to uppercase for case-insensitive matching
    const normalizedCode = referralCode.toUpperCase().trim();

    console.log('[ReferralService] Validating referral code:', normalizedCode);

    // Use case-insensitive query (PostgreSQL UPPER)
    const referrer = await this.userRepository
      .createQueryBuilder('user')
      .where('UPPER(user.referralCode) = UPPER(:code)', { code: normalizedCode })
      .getOne();

    console.log('[ReferralService] Referrer found:', referrer ? `Yes (ID: ${referrer.id})` : 'No');

    if (!referrer) {
      console.warn('[ReferralService] Referral code not found in database:', normalizedCode);
      throw new BadRequestException('Invalid referral code');
    }

    if (walletAddress && referrer.walletAddress === walletAddress) {
      throw new BadRequestException('Cannot refer yourself');
    }

    return referrer;
  }

  async processGameCommission(
    params: ProcessGameCommissionParams,
  ): Promise<ReferralRewardEntity> {
    const { refereeId, referrerId, feeAmount, killLogId, actionType, metadata } =
      params;

    console.log('[ReferralService] processGameCommission called:', {
      refereeId,
      referrerId,
      feeAmount,
      killLogId,
      actionType,
      killCommissionRate: this.killCommissionRate,
      deathCommissionRate: this.deathCommissionRate,
      expectedKillCommission: this.toNumber(feeAmount) * this.killCommissionRate,
      expectedDeathCommission: this.toNumber(feeAmount) * this.deathCommissionRate,
    });

    // Check if already processed (idempotent)
    // Query by checking metadata contains kill_log_id and action_type
    const existing = await this.referralRewardRepository
      .createQueryBuilder('reward')
      .where('reward.referrer_id = :referrerId', { referrerId })
      .andWhere('reward.referee_id = :refereeId', { refereeId })
      .andWhere("reward.metadata->>'kill_log_id' = :killLogId", { killLogId })
      .andWhere("reward.metadata->>'action_type' = :actionType", { actionType })
      .getOne();

    if (existing) {
      console.log('[ReferralService] Commission already processed:', existing.id);
      return existing;
    }

    // Calculate commission
    const feeAmountNumber = this.toNumber(feeAmount);
    const commissionRate =
      actionType === 'kill'
        ? this.killCommissionRate
        : this.deathCommissionRate;
    const commission = feeAmountNumber * commissionRate;

    console.log('[ReferralService] Commission calculation:', {
      feeAmountNumber,
      commissionRate,
      commission,
    });

    // Check commission cap
    if (this.commissionCapPerUser) {
      const totalCommission = await this.getTotalCommissionFromReferee(
        referrerId,
        refereeId,
      );
      if (totalCommission + commission > this.commissionCapPerUser) {
        throw new BadRequestException(
          'Commission cap exceeded for this referee',
        );
      }
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        console.log('[ReferralService] Starting transaction for commission:', {
          referrerId,
          refereeId,
          commission,
        });

        const referralRewardRepo =
          manager.getRepository(ReferralRewardEntity);
        const transactionRepo = manager.getRepository(TransactionEntity);
        const walletRepo = manager.getRepository(WalletBalanceEntity);

        // Create referral reward record
        const referralReward = referralRewardRepo.create({
          referrer: { id: referrerId } as UserEntity,
          referee: { id: refereeId } as UserEntity,
          rewardType: ReferralRewardType.GAME_COMMISSION,
          amount: this.formatAmount(commission),
          status: ReferralRewardStatus.PENDING,
          metadata: {
            action_type: actionType,
            fee_amount: feeAmount,
            kill_log_id: typeof killLogId === 'string' ? killLogId : String(killLogId),
            ...metadata,
          },
        });

        console.log('[ReferralService] Creating referral reward:', {
          amount: referralReward.amount,
          referrerId,
          refereeId,
          rewardType: referralReward.rewardType,
          status: referralReward.status,
        });

        let savedReward;
        try {
          savedReward = await referralRewardRepo.save(referralReward);
          console.log('[ReferralService] Referral reward saved:', savedReward.id);
        } catch (saveError) {
          console.error('[ReferralService] Error saving referral reward:', {
            error: saveError.message,
            stack: saveError.stack,
            referralReward: {
              amount: referralReward.amount,
              referrerId,
              refereeId,
            },
          });
          throw saveError;
        }

        // Create transaction for referrer
        const transaction = transactionRepo.create({
          user: { id: referrerId },
          type: TransactionType.REWARD,
          status: TransactionStatus.CONFIRMED,
          amount: this.formatAmount(commission),
          metadata: {
            referral_reward_id: savedReward.id,
            reward_type: 'game_commission',
            action_type: actionType,
            kill_log_id: killLogId,
            fee_amount: feeAmount,
          },
        });

        console.log('[ReferralService] Creating transaction:', {
          amount: transaction.amount,
          userId: transaction.user,
        });

        const savedTransaction = await transactionRepo.save(transaction);
        console.log('[ReferralService] Transaction saved:', savedTransaction.id);

        // Update wallet balance
        console.log('[ReferralService] Getting wallet balance for:', referrerId);
        const balance = await this.getOrCreateWalletBalance(
          referrerId,
          walletRepo,
        );
        console.log('[ReferralService] Current balance:', {
          availableAmount: balance.availableAmount,
          lockedAmount: balance.lockedAmount,
        });

        const currentAmount = this.toNumber(balance.availableAmount);
        const newAmount = currentAmount + commission;
        balance.availableAmount = this.formatAmount(newAmount);
        balance.lastTransactionId = savedTransaction.id;
        
        console.log('[ReferralService] Updating balance:', {
          currentAmount,
          commission,
          newAmount,
          formattedNewAmount: balance.availableAmount,
        });

        await walletRepo.save(balance);
        console.log('[ReferralService] Wallet balance saved');

        console.log('[ReferralService] Wallet balance updated:', {
          referrerId,
          currentAmount,
          commission,
          newAmount,
          formattedNewAmount: balance.availableAmount,
        });

        // Update referral reward
        savedReward.transaction = savedTransaction;
        savedReward.status = ReferralRewardStatus.CONFIRMED;
        await referralRewardRepo.save(savedReward);
        console.log('[ReferralService] Referral reward status updated to CONFIRMED');

        console.log('[ReferralService] Commission processed successfully:', {
          referralRewardId: savedReward.id,
          amount: savedReward.amount,
          transactionId: savedTransaction.id,
        });

        return savedReward;
      });
    } catch (error) {
      console.error('[ReferralService] Error processing commission:', {
        error: error.message,
        stack: error.stack,
        referrerId,
        refereeId,
        commission,
      });
      throw error;
    }
  }

  async getReferralStats(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Generate referral code if missing (for users created before migration)
      if (!user.referralCode) {
        user.referralCode = await this.generateUniqueReferralCode();
        await this.userRepository.save(user);
      }

      const skip = (page - 1) * limit;

      // Get total referrals count
      const totalReferrals = await this.userRepository
        .createQueryBuilder('user')
        .where('user.referred_by_id = :userId', { userId })
        .getCount();

      // Get referrals with pagination
      const referrals = await this.userRepository
        .createQueryBuilder('user')
        .where('user.referred_by_id = :userId', { userId })
        .orderBy('user.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      // Get total earned
      const confirmedRewards = await this.referralRewardRepository
        .createQueryBuilder('reward')
        .where('reward.referrer_id = :userId', { userId })
        .andWhere('reward.status = :status', {
          status: ReferralRewardStatus.CONFIRMED,
        })
        .getMany();

      let totalEarned = 0;
      let earnedFromKills = 0;
      let earnedFromDeaths = 0;

      for (const reward of confirmedRewards) {
        const amount = this.toNumber(reward.amount);
        if (isNaN(amount)) continue;
        totalEarned += amount;

        const actionType = reward.metadata?.action_type as string;
        if (actionType === 'kill') {
          earnedFromKills += amount;
        } else if (actionType === 'death') {
          earnedFromDeaths += amount;
        }
      }

      // Get stats per referee
      const referralsWithStats = await Promise.all(
        referrals.map(async (referee) => {
          const refereeRewards = await this.referralRewardRepository
            .createQueryBuilder('reward')
            .where('reward.referrer_id = :userId', { userId })
            .andWhere('reward.referee_id = :refereeId', { refereeId: referee.id })
            .andWhere('reward.status = :status', {
              status: ReferralRewardStatus.CONFIRMED,
            })
            .getMany();

          let refereeEarned = 0;
          let refereeEarnedFromKills = 0;
          let refereeEarnedFromDeaths = 0;

          for (const reward of refereeRewards) {
            const amount = this.toNumber(reward.amount);
            if (isNaN(amount)) continue;
            refereeEarned += amount;

            const actionType = reward.metadata?.action_type as string;
            if (actionType === 'kill') {
              refereeEarnedFromKills += amount;
            } else if (actionType === 'death') {
              refereeEarnedFromDeaths += amount;
            }
          }

          return {
            refereeId: referee.id,
            refereeWallet: referee.walletAddress,
            refereeDisplayName: referee.displayName || '',
            joinedAt: referee.created_at,
            totalEarned: this.formatAmount(refereeEarned),
            earnedFromKills: this.formatAmount(refereeEarnedFromKills),
            earnedFromDeaths: this.formatAmount(refereeEarnedFromDeaths),
            lastActivityAt: referee.lastLoginAt || null,
          };
        }),
      );

      const frontendUrl =
        this.configService.get<string>('app.frontendUrl') ||
        this.configService.get<string>('FRONTEND_URL') ||
        'https://slither.fit';

      return {
        referralCode: user.referralCode || '',
        referralLink: user.referralCode
          ? `${frontendUrl}?ref=${user.referralCode}`
          : '',
        totalReferrals,
        activeReferrals: totalReferrals, // TODO: Calculate active referrals based on last activity
        totalEarned: this.formatAmount(totalEarned),
        earnedFromKills: this.formatAmount(earnedFromKills),
        earnedFromDeaths: this.formatAmount(earnedFromDeaths),
        referrals: referralsWithStats,
        pagination: {
          page,
          limit,
          total: totalReferrals,
          totalPages: Math.ceil(totalReferrals / limit) || 1,
        },
      };
    } catch (error) {
      console.error('[ReferralService] getReferralStats error:', error);
      throw error;
    }
  }

  private async getTotalCommissionFromReferee(
    referrerId: string,
    refereeId: string,
  ): Promise<number> {
    const rewards = await this.referralRewardRepository
      .createQueryBuilder('reward')
      .where('reward.referrer_id = :referrerId', { referrerId })
      .andWhere('reward.referee_id = :refereeId', { refereeId })
      .andWhere('reward.status = :status', {
        status: ReferralRewardStatus.CONFIRMED,
      })
      .getMany();

    return rewards.reduce(
      (sum, reward) => sum + this.toNumber(reward.amount),
      0,
    );
  }

  private async getOrCreateWalletBalance(
    userId: string,
    repository: any,
  ) {
    let balance = await repository.findOne({
      where: { user: { id: userId } },
    });

    if (!balance) {
      balance = repository.create({
        user: { id: userId },
        availableAmount: this.formatAmount(0),
        lockedAmount: this.formatAmount(0),
      });
      balance = await repository.save(balance);
    }

    return balance;
  }

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(this.referralCodeLength);
    let code = '';

    for (let i = 0; i < this.referralCodeLength; i++) {
      code += chars[bytes[i] % chars.length];
    }

    return code;
  }

  private formatAmount(value: number): string {
    return value.toFixed(this.tokenDecimals);
  }

  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? 0 : num;
  }
}

