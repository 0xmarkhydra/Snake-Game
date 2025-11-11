import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsSolanaAddress } from '@/shared/validator/decorators/isSolanaAddress';

export class DepositRequestDto {
  @ApiProperty({ description: 'Wallet address that will originate the deposit' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({ description: 'Amount user wants to deposit', example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  amount: number;
}

export class DepositMetadataDto {
  @ApiProperty({ description: 'Token mint address used for deposit' })
  tokenMint: string;

  @ApiProperty({ description: 'Number of decimals for the token', example: 6 })
  decimals: number;

  @ApiProperty({ description: 'Amount formatted according to decimals', example: '10.000000' })
  amount: string;

  @ApiProperty({ description: 'Reference code for the deposit request' })
  referenceCode: string;

  @ApiProperty({ description: 'Memo to include in the transaction' })
  memo: string;
}

export class DepositResponseDto {
  @ApiProperty({ type: DepositMetadataDto })
  metadata: DepositMetadataDto;
}

export class WithdrawRequestDto {
  @ApiProperty({
    description: 'Destination wallet address on Solana',
    example: 'HPfcPDMfcMsYdhiF8Z8iYwP6M9dTQdZJxrwK1kDiJCWq',
  })
  @IsString()
  @IsNotEmpty()
  @IsSolanaAddress()
  recipientAddress: string;

  @ApiProperty({
    description: 'Amount of tokens to withdraw',
    example: 2,
    minimum: 0.000001,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  amount: number;
}

export class WithdrawResponseDto {
  @ApiProperty({
    description: 'Signature returned by the payment service',
    example: '3pnv7WY4zpw1XNGY29n79w1vvWr69WyDxzxgyRv7tN7LgXbcP88ToXQyzD7zt8jF2ZyR1PiCkt9EXutXe8fb4Up2',
  })
  signature: string;

  @ApiProperty({
    description: 'External transaction identifier provided by the payment service',
    example: '6912f9c75f9f5b08e2a3638f',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Destination wallet address that received the withdrawal',
    example: 'HPfcPDMfcMsYdhiF8Z8iYwP6M9dTQdZJxrwK1kDiJCWq',
  })
  recipientAddress: string;

  @ApiProperty({
    description: 'Amount of tokens sent to the recipient',
    example: 2,
  })
  amount: number;

  @ApiProperty({
    description: 'Token mint address used for the withdrawal',
    example: 'EweSxUxv3RRwmGwV4i77DkSgkgQt3CHbQc62YEwDEzC9',
  })
  mintAddress: string;

  @ApiProperty({
    description: 'Source wallet address that executed the transfer',
    example: 'CWZDCmkzzBSwQVMLaJ3ALpSAKJ9oGQoo9Jn8oN2TrNz',
  })
  senderAddress: string;

  @ApiProperty({
    description: 'Flag indicating whether a token account was created for the recipient',
    example: false,
  })
  tokenAccountCreated: boolean;

  @ApiProperty({
    description: 'User available balance after the withdrawal, formatted with token decimals',
    example: '8.000000',
  })
  availableAmount: string;
}

export class WebhookDepositDataDto {
  @ApiProperty({ description: 'Wallet address of the depositor' })
  @IsString()
  @IsNotEmpty()
  user: string;

  @ApiProperty({ description: 'Amount sent on-chain as a string', example: '1000000' })
  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class WebhookDepositEventDto {
  @ApiProperty({ description: 'Transaction signature' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ description: 'Slot on Solana', example: 420122255 })
  @IsOptional()
  slot?: number;

  @ApiProperty({ description: 'Block time on Solana', example: 1762592529 })
  @IsOptional()
  blockTime?: number;

  @ApiProperty({ description: 'Event type from indexer', example: 'DepositEvent' })
  @IsString()
  eventType: string;

  @ApiProperty({ description: 'Event success flag', example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ type: WebhookDepositDataDto })
  @ValidateNested()
  @Type(() => WebhookDepositDataDto)
  data: WebhookDepositDataDto;
}

export class DepositWebhookDto {
  @ApiProperty({ type: WebhookDepositEventDto })
  @ValidateNested()
  @Type(() => WebhookDepositEventDto)
  event: WebhookDepositEventDto;

  @ApiPropertyOptional({ description: 'Indexer timestamp', example: 1762601253479 })
  @IsOptional()
  timestamp?: number;

  @ApiPropertyOptional({ description: 'Indexer version', example: '1.0.0' })
  @IsOptional()
  indexerVersion?: string;
}

export class CreditResponseDto {
  @ApiProperty({ description: 'Available credit for the user', example: '15.000000' })
  credit: string;
}

export class ResetWalletBalanceRequestDto {
  @ApiProperty({
    description: 'Wallet address whose balance will be reset',
    example: 'F1r5tAaAA3jSGbqZMoCpeXXv1Ld1z1uS7WALLET',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

export class ResetWalletBalanceResponseDto {
  @ApiProperty({
    description: 'Wallet address after reset',
    example: 'F1r5tAaAA3jSGbqZMoCpeXXv1Ld1z1uS7WALLET',
  })
  walletAddress: string;

  @ApiProperty({ description: 'Available amount after reset', example: '0.000000' })
  availableAmount: string;

  @ApiProperty({ description: 'Locked amount after reset', example: '0.000000' })
  lockedAmount: string;
}
