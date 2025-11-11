import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreditResponseDto,
  DepositRequestDto,
  DepositResponseDto,
  DepositWebhookDto,
  ResetWalletBalanceRequestDto,
  ResetWalletBalanceResponseDto,
} from '@/api/dtos';
import { WalletService } from '@/business/services';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { JwtAuthGuard } from '@/api/guards/jwt-auth.guard';
import { CurrentUserId } from '@/api/decorator/user.decorator';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create deposit metadata for @solana-payment/sdk' })
  @ApiResponse({ status: HttpStatus.OK, type: DepositResponseDto })
  @ResponseMessage('Deposit metadata generated successfully')
  async createDepositMetadata(
    @Body() payload: DepositRequestDto,
  ): Promise<DepositResponseDto> {
    const metadata = await this.walletService.createDepositMetadata(
      payload.walletAddress,
      payload.amount,
    );
    return { metadata };
  }

  @Post('reset-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset wallet balance to zero by address' })
  @ApiResponse({ status: HttpStatus.OK, type: ResetWalletBalanceResponseDto })
  @ResponseMessage('Wallet balance reset successfully')
  async resetWalletBalance(
    @Body() payload: ResetWalletBalanceRequestDto,
  ): Promise<ResetWalletBalanceResponseDto> {
    return this.walletService.resetWalletBalanceByAddress(
      payload.walletAddress,
    );
  }

  @Get('credit')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @CacheTTL(1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current credit balance' })
  @ApiResponse({ status: HttpStatus.OK, type: CreditResponseDto })
  @ResponseMessage('Credit retrieved successfully')
  async getCredit(@CurrentUserId() userId: string): Promise<CreditResponseDto> {
    const credit = await this.walletService.getCredit(userId);
    return { credit };
  }

  @Post('/webhook/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive deposit webhook from indexer' })
  @ApiResponse({ status: HttpStatus.OK })
  @ResponseMessage('Webhook processed successfully')
  async handleWebhook(
    @Body() payload: DepositWebhookDto,
    @Headers('x-webhook-secret') secret?: string,
  ): Promise<{ processed: boolean }> {
    return this.walletService.handleDepositWebhook(payload, secret);
  }
}
