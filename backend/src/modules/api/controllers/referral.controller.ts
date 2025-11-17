import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  GetReferralStatsQueryDto,
  ReferralCodeResponseDto,
  ReferralStatsResponseDto,
  ValidateReferralCodeDto,
  ValidateReferralCodeResponseDto,
} from '@/api/dtos';
import { ReferralService } from '@/business/services';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { JwtAuthGuard } from '@/api/guards/jwt-auth.guard';
import { CurrentUserId } from '@/api/decorator/user.decorator';

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('my-code')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get referral code and stats for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ReferralCodeResponseDto,
  })
  @ResponseMessage('Referral code retrieved successfully')
  async getMyReferralCode(
    @CurrentUserId() userId: string,
  ): Promise<ReferralCodeResponseDto> {
    const stats = await this.referralService.getReferralStats(userId, 1, 1);
    return {
      referralCode: stats.referralCode ?? '',
      referralLink: stats.referralLink ?? '',
      totalReferrals: stats.totalReferrals,
      activeReferrals: stats.activeReferrals,
      totalEarned: stats.totalEarned,
      earnedFromKills: stats.earnedFromKills,
      earnedFromDeaths: stats.earnedFromDeaths,
    };
  }

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get detailed referral statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ReferralStatsResponseDto,
  })
  @ResponseMessage('Referral stats retrieved successfully')
  async getReferralStats(
    @CurrentUserId() userId: string,
    @Query() query: GetReferralStatsQueryDto,
  ): Promise<ReferralStatsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const stats = await this.referralService.getReferralStats(userId, page, limit);
    return {
      totalReferrals: stats.totalReferrals,
      activeReferrals: stats.activeReferrals,
      totalEarned: stats.totalEarned,
      earnedFromKills: stats.earnedFromKills,
      earnedFromDeaths: stats.earnedFromDeaths,
      referrals: stats.referrals,
      pagination: stats.pagination,
    };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate referral code (public endpoint)' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ValidateReferralCodeResponseDto,
  })
  @ResponseMessage('Referral code validated')
  async validateReferralCode(
    @Body() payload: ValidateReferralCodeDto,
  ): Promise<ValidateReferralCodeResponseDto> {
    try {
      const referrer = await this.referralService.validateAndGetReferrer(
        payload.referralCode,
        '', // walletAddress not needed for validation
      );

      if (!referrer) {
        return { valid: false };
      }

      // Mask wallet address for privacy
      const wallet = referrer.walletAddress;
      const maskedWallet =
        wallet.length > 8
          ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
          : wallet;

      return {
        valid: true,
        referrerWallet: maskedWallet,
        referrerDisplayName: referrer.displayName,
      };
    } catch (error) {
      return { valid: false };
    }
  }
}

