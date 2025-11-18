import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import axios, { AxiosError } from 'axios';
import {
  TransactionRepository,
  UserRepository,
  WalletBalanceRepository,
} from '@/database/repositories';
import {
  TransactionStatus,
  TransactionType,
  TransactionEntity,
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

type PaymentTransferSuccessResponse = {
  success: true;
  signature: string;
  recipientAddress: string;
  amount: number;
  mintAddress: string;
  senderAddress: string;
  tokenAccountCreated: boolean;
  transactionId: string;
};

type PaymentTransferErrorResponse = {
  success: false;
  message?: string;
  retryAfter?: number;
};

type WithdrawParams = {
  userId: string;
  recipientAddress: string;
  amount: number;
};

type WithdrawResult = {
  signature: string;
  transactionId: string;
  recipientAddress: string;
  amount: number;
  mintAddress: string;
  senderAddress: string;
  tokenAccountCreated: boolean;
  availableAmount: string;
};

@Injectable()
export class WalletService {
  private readonly tokenMint: string;
  private readonly tokenDecimals: number;
  private readonly webhookSecret?: string;
  private readonly paymentTransferUrl: string;
  private readonly paymentTimeoutMs = 10000;

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
    this.paymentTransferUrl =
      this.configService.get<string>('wallet.paymentTransferUrl') ?? '';
    console.log('[WalletService] tokenDecimals:', this.tokenDecimals);
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

  async handleDepositWebhook(
    payload: DepositWebhookPayload,
    secretHeader?: string,
  ): Promise<{ processed: boolean }> {
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

    const normalizedAmount = this.normalizeWebhookAmount(rawAmount);
    if (normalizedAmount.tokens <= 0) {
      throw new UnauthorizedException('Invalid webhook amount');
    }

    const amountInTokens = normalizedAmount.tokens;
    const transaction = this.transactionRepository.create({
      user,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.CONFIRMED,
      amount: this.formatAmount(amountInTokens),
      signature,
      metadata: {
        rawAmount: normalizedAmount.raw.toString(),
        rawAmountSource: rawAmount,
        decimals: this.tokenDecimals,
        timestamp: payload.timestamp,
        indexerVersion: payload.indexerVersion,
      },
      processedAt: new Date(),
      occurredAt: new Date(),
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    await this.updateWalletBalance(
      user.id,
      amountInTokens,
      savedTransaction.id,
    );

    return { processed: true };
  }

  async resetWalletBalanceByAddress(walletAddress: string): Promise<{
    walletAddress: string;
    availableAmount: string;
    lockedAmount: string;
  }> {
    const user = await this.getOrCreateUserByWallet(walletAddress);
    const balance = await this.getOrCreateWalletBalance(user.id);

    balance.availableAmount = this.formatAmount(0);
    balance.lockedAmount = this.formatAmount(0);
    balance.lastTransactionId = null;

    const savedBalance = await this.walletBalanceRepository.save(balance);

    return {
      walletAddress: user.walletAddress,
      availableAmount: savedBalance.availableAmount,
      lockedAmount: savedBalance.lockedAmount,
    };
  }

  async withdraw(params: WithdrawParams): Promise<WithdrawResult> {
    this.ensurePaymentConfigured();
    this.assertValidAmount(params.amount);

    const user = await this.getUser(params.userId);
    const balance = await this.getOrCreateWalletBalance(user.id);
    this.assertSufficientBalance(balance.availableAmount, params.amount);

    const transaction = await this.createPendingWithdrawTransaction({
      user,
      amount: params.amount,
      recipientAddress: params.recipientAddress,
    });

    try {
      const transferResponse = await this.requestPaymentTransfer({
        recipientAddress: params.recipientAddress,
        amount: params.amount,
      });

      const availableAmount = await this.finalizeSuccessfulWithdraw(
        transaction,
        transferResponse,
        params.amount,
        user.id,
      );

      return this.buildWithdrawResult(transferResponse, availableAmount);
    } catch (error) {
      await this.finalizeFailedWithdraw(transaction, error);
      throw error;
    }
  }

  private async getUser(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async getOrCreateUserByWallet(
    walletAddress: string,
  ): Promise<UserEntity> {
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

  private async getOrCreateWalletBalance(
    userId: string,
  ): Promise<WalletBalanceEntity> {
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

  private async updateWalletBalance(
    userId: string,
    delta: number,
    transactionId?: string,
  ) {
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

  private normalizeWebhookAmount(amount: string | number): {
    raw: number;
    tokens: number;
  } {
    if (amount === null || amount === undefined) {
      return { raw: 0, tokens: 0 };
    }
    const numericValue = Number(amount);
    if (Number.isNaN(numericValue)) {
      return { raw: 0, tokens: 0 };
    }

    const hasDecimalPoint = typeof amount === 'string' && amount.includes('.');
    if (hasDecimalPoint) {
      const tokens = numericValue;
      const raw = Math.round(tokens * Math.pow(10, this.tokenDecimals));
      return { raw, tokens };
    }

    const raw = Math.trunc(numericValue);
    const tokens = raw / Math.pow(10, this.tokenDecimals);
    return { raw, tokens };
  }

  private formatAmount(value: number): string {
    return value.toFixed(this.tokenDecimals);
  }

  private ensurePaymentConfigured() {
    if (!this.paymentTransferUrl) {
      throw new UnauthorizedException('Payment service is not configured');
    }
  }

  private assertValidAmount(amount: number) {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new BadRequestException(
        'Withdrawal amount must be greater than zero',
      );
    }
  }

  private assertSufficientBalance(availableAmount: string, amount: number) {
    const current = Number(availableAmount);
    if (Number.isNaN(current) || current < amount) {
      throw new BadRequestException('Insufficient balance');
    }
  }

  private async createPendingWithdrawTransaction(params: {
    user: UserEntity;
    amount: number;
    recipientAddress: string;
  }): Promise<TransactionEntity> {
    const transaction = this.transactionRepository.create({
      user: params.user,
      type: TransactionType.WITHDRAW,
      status: TransactionStatus.PENDING,
      amount: this.formatAmount(params.amount),
      referenceCode: uuid(),
      metadata: {
        recipientAddress: params.recipientAddress,
      },
    });
    return this.transactionRepository.save(transaction);
  }

  private async finalizeSuccessfulWithdraw(
    transaction: TransactionEntity,
    response: PaymentTransferSuccessResponse,
    amount: number,
    userId: string,
  ): Promise<string> {
    transaction.status = TransactionStatus.CONFIRMED;
    transaction.signature = response.signature;
    transaction.metadata = {
      ...(transaction.metadata ?? {}),
      transfer: response,
    };
    transaction.processedAt = new Date();

    await this.transactionRepository.save(transaction);
    await this.updateWalletBalance(userId, -amount, transaction.id);
    const updatedBalance = await this.getOrCreateWalletBalance(userId);
    return updatedBalance.availableAmount;
  }

  private async finalizeFailedWithdraw(
    transaction: TransactionEntity,
    error: unknown,
  ) {
    transaction.status = TransactionStatus.FAILED;
    transaction.metadata = {
      ...(transaction.metadata ?? {}),
      error: this.buildErrorMetadata(error),
    };
    transaction.processedAt = new Date();
    await this.transactionRepository.save(transaction);
  }

  private buildWithdrawResult(
    response: PaymentTransferSuccessResponse,
    availableAmount: string,
  ): WithdrawResult {
    return {
      signature: response.signature,
      transactionId: response.transactionId,
      recipientAddress: response.recipientAddress,
      amount: response.amount,
      mintAddress: response.mintAddress,
      senderAddress: response.senderAddress,
      tokenAccountCreated: response.tokenAccountCreated,
      availableAmount,
    };
  }

  private async requestPaymentTransfer(params: {
    recipientAddress: string;
    amount: number;
  }): Promise<PaymentTransferSuccessResponse> {
    try {
      const response = await axios.post<PaymentTransferSuccessResponse>(
        this.paymentTransferUrl,
        {
          recipientAddress: params.recipientAddress,
          amount: params.amount,
        },
        {
          timeout: this.paymentTimeoutMs,
        },
      );

      if (!response.data?.success) {
        throw new BadRequestException(
          'Payment service responded without success status',
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw error;
    }
  }

  private handleAxiosError(
    error: AxiosError<PaymentTransferErrorResponse>,
  ): never {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            data?.message ??
            'Duplicate request detected, please try again later',
          retryAfter: data?.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (status && status >= 400 && status < 500) {
      throw new BadRequestException(
        data?.message ?? 'Payment service rejected the transfer request',
      );
    }

    throw new InternalServerErrorException(
      data?.message ?? 'Unable to reach payment service',
    );
  }

  private buildErrorMetadata(error: unknown) {
    if (error instanceof HttpException) {
      return {
        status: error.getStatus(),
        response: error.getResponse(),
        message: error.message,
      };
    }

    if (axios.isAxiosError(error)) {
      return {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
    }

    if (error instanceof Error) {
      return { message: error.message };
    }

    return { message: 'Unknown error' };
  }
}
