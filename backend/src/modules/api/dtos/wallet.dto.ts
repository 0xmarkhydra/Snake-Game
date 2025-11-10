import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
