import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateReferralCodeDto {
  @ApiProperty({
    description: 'Referral code to validate',
    example: 'ABC12345',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 16)
  referralCode: string;
}

export class ValidateReferralCodeResponseDto {
  @ApiProperty({ description: 'Whether the referral code is valid' })
  valid: boolean;

  @ApiPropertyOptional({
    description: 'Wallet address of the referrer (partially masked)',
  })
  referrerWallet?: string;

  @ApiPropertyOptional({
    description: 'Display name of the referrer',
  })
  referrerDisplayName?: string;
}

export class ReferralCodeResponseDto {
  @ApiProperty({ description: 'User referral code', example: 'ABC12345' })
  referralCode: string;

  @ApiProperty({
    description: 'Full referral link',
    example: 'https://game.com?ref=ABC12345',
  })
  referralLink: string;

  @ApiProperty({ description: 'Total number of referrals', example: 10 })
  totalReferrals: number;

  @ApiProperty({ description: 'Number of active referrals', example: 7 })
  activeReferrals: number;

  @ApiProperty({ description: 'Total earned from referrals', example: '4.5' })
  totalEarned: string;

  @ApiProperty({
    description: 'Earned from kills',
    example: '3.0',
  })
  earnedFromKills: string;

  @ApiProperty({
    description: 'Earned from deaths',
    example: '1.5',
  })
  earnedFromDeaths: string;
}

export class ReferralStatsItemDto {
  @ApiProperty({ description: 'Referee user ID' })
  refereeId: string;

  @ApiProperty({ description: 'Referee wallet address' })
  refereeWallet: string;

  @ApiPropertyOptional({ description: 'Referee display name' })
  refereeDisplayName?: string;

  @ApiProperty({ description: 'When the referee joined' })
  joinedAt: Date;

  @ApiProperty({ description: 'Total earned from this referee', example: '5.5' })
  totalEarned: string;

  @ApiProperty({
    description: 'Earned from kills from this referee',
    example: '4.0',
  })
  earnedFromKills: string;

  @ApiProperty({
    description: 'Earned from deaths from this referee',
    example: '1.5',
  })
  earnedFromDeaths: string;

  @ApiPropertyOptional({
    description: 'Last activity timestamp',
  })
  lastActivityAt?: Date;
}

export class PaginationDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of items', example: 100 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 10 })
  totalPages: number;
}

export class ReferralStatsResponseDto {
  @ApiProperty({ description: 'Total number of referrals', example: 10 })
  totalReferrals: number;

  @ApiProperty({ description: 'Number of active referrals', example: 7 })
  activeReferrals: number;

  @ApiProperty({ description: 'Total earned from referrals', example: '4.5' })
  totalEarned: string;

  @ApiProperty({
    description: 'Earned from kills',
    example: '3.0',
  })
  earnedFromKills: string;

  @ApiProperty({
    description: 'Earned from deaths',
    example: '1.5',
  })
  earnedFromDeaths: string;

  @ApiProperty({
    description: 'List of referrals with stats',
    type: [ReferralStatsItemDto],
  })
  referrals: ReferralStatsItemDto[];

  @ApiProperty({ description: 'Pagination information', type: PaginationDto })
  pagination: PaginationDto;
}

export class GetReferralStatsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    default: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

