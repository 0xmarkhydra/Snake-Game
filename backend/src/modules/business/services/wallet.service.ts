import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import {
  TransactionRepository,
  UserRepository,
  WalletBalanceRepository,
} from '@/database/repositories';
import {
  TransactionStatus,
  TransactionType,
  UserEntity,
  WalletBalanceEntity,
} from '@/database/entities';

type DepositMetadata = {
  tokenMint: string;
  decimals: number;
  amount: string;
  referenceCode: string;
  memo: string;
};

type DepositWebhookEvent = {
  signature: string;
  eventType: string;
  success: boolean;
  data: {
    user: string;
    amount: string;
  };
};

type DepositWebhookPayload = {
  event: DepositWebhookEvent;
  timestamp?: number;
  indexerVersion?: string;
};

@Injectable()
export class WalletService {
  private readonly tokenMint: string;
  private readonly tokenDecimals: number;
  private readonly webhookSecret?: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly configService: ConfigService,
  ) {
    this.tokenMint = this.configService.get<string>('wallet.tokenMint') ?? '';
    this.tokenDecimals = Number(
      this.configService.get<number>('wallet.tokenDecimals') ?? 6,
    );
    this.webhookSecret = this.configService.get<string>('wallet.webhookSecret');
  }

  async createDepositMetadata(
    walletAddress: string,
    amount: number,
  ): Promise<DepositMetadata> {
    if (!this.tokenMint) {
      throw new UnauthorizedException('Deposit token mint is not configured');
    }

    const user = await this.getOrCreateUserByWallet(walletAddress);
    const normalizedAmount = this.formatAmount(amount);
    const referenceCode = uuid();
    const memo = `deposit:${user.id}:${referenceCode}`;

    return {
      tokenMint: this.tokenMint,
      decimals: this.tokenDecimals,
      amount: normalizedAmount,
      referenceCode,
      memo,
    };
  }

  async getCredit(userId: string): Promise<string> {
    const balance = await this.getOrCreateWalletBalance(userId);
    return balance.availableAmount;
  }

  async handleDepositWebhook(payload: DepositWebhookPayload, secretHeader?: string): Promise<{ processed: boolean }> {
    if (this.webhookSecret && secretHeader !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (!payload?.event) {
      throw new UnauthorizedException('Missing event payload');
    }

    const { event } = payload;
    if (!event.success || event.eventType !== 'DepositEvent') {
      return { processed: false };
    }

    const signature = event.signature;
    const userWallet = event.data?.user;
    const rawAmount = event.data?.amount;

    if (!signature || !userWallet || !rawAmount) {
      throw new UnauthorizedException('Invalid webhook payload');
    }

    const existingTransaction = await this.transactionRepository.findOne({
      where: { signature },
      relations: ['user'],
    });
    if (existingTransaction) {
      if (existingTransaction.status !== TransactionStatus.CONFIRMED) {
        existingTransaction.status = TransactionStatus.CONFIRMED;
        existingTransaction.processedAt = new Date();
        await this.transactionRepository.save(existingTransaction);
        await this.updateWalletBalance(
          existingTransaction.user.id,
          Number(existingTransaction.amount),
        );
        return { processed: true };
      }
      return { processed: false };
    }

    const user = await this.getOrCreateUserByWallet(userWallet);

    const amountInTokens = this.toTokenAmount(rawAmount);
    const transaction = this.transactionRepository.create({
      user,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.CONFIRMED,
      amount: this.formatAmount(amountInTokens),
      signature,
      metadata: {
        rawAmount,
        decimals: this.tokenDecimals,
        timestamp: payload.timestamp,
        indexerVersion: payload.indexerVersion,
      },
      processedAt: new Date(),
      occurredAt: new Date(),
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    await this.updateWalletBalance(user.id, amountInTokens, savedTransaction.id);

    return { processed: true };
  }

  private async getUser(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async getOrCreateUserByWallet(walletAddress: string): Promise<UserEntity> {
    let user = await this.userRepository.findOne({ where: { walletAddress } });
    if (!user) {
      user = this.userRepository.create({
        walletAddress,
        displayName: walletAddress.slice(0, 8),
      });
      user = await this.userRepository.save(user);
    }
    return user;
  }

  private async getOrCreateWalletBalance(userId: string): Promise<WalletBalanceEntity> {
    let balance = await this.walletBalanceRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!balance) {
      const user = await this.getUser(userId);
      balance = this.walletBalanceRepository.create({
        user,
        availableAmount: this.formatAmount(0),
        lockedAmount: this.formatAmount(0),
      });
      balance = await this.walletBalanceRepository.save(balance);
    }

    return balance;
  }

  private async updateWalletBalance(userId: string, delta: number, transactionId?: string) {
    const balance = await this.getOrCreateWalletBalance(userId);
    const currentAvailable = Number(balance.availableAmount);
    const nextValue = currentAvailable + delta;

    balance.availableAmount = this.formatAmount(nextValue);
    if (transactionId) {
      balance.lastTransactionId = transactionId;
    }

    await this.walletBalanceRepository.save(balance);
  }

  private toTokenAmount(raw: string | number): number {
    const rawNumber = Number(raw);
    if (Number.isNaN(rawNumber)) {
      return 0;
    }
    return rawNumber / Math.pow(10, this.tokenDecimals);
  }

  private formatAmount(value: number): string {
    return value.toFixed(this.tokenDecimals);
  }
}
