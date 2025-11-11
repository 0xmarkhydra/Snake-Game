import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  VipAccessCheckRequestDto,
  VipAccessCheckResponseDto,
  VipConsumeTicketRequestDto,
  VipConsumeTicketResponseDto,
  VipKillRewardRequestDto,
  VipKillRewardResponseDto,
  VipRespawnRequestDto,
  VipRespawnResponseDto,
  VipRoomConfigDto,
  VipTicketInfoDto,
  VipValidateTicketRequestDto,
  VipValidateTicketResponseDto,
} from '@/api/dtos';
import { VipGameService } from '@/business/services';
import {
  VipRoomType,
  VipTicketEntity,
  VipRoomConfigEntity,
} from '@/database/entities';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { JwtAuthGuard } from '@/api/guards/jwt-auth.guard';
import { CurrentUserId } from '@/api/decorator/user.decorator';
import { InternalApiKeyGuard } from '@/api/guards/internal-api-key.guard';

@ApiTags('Game')
@Controller('game')
export class GameController {
  constructor(private readonly vipGameService: VipGameService) {}

  @Post('rooms/vip/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Evaluate whether the authenticated user can join the VIP room',
  })
  @ApiResponse({ status: HttpStatus.OK, type: VipAccessCheckResponseDto })
  @ResponseMessage('VIP room access evaluated successfully')
  async checkVipAccess(
    @CurrentUserId() userId: string,
    @Body() payload: VipAccessCheckRequestDto,
  ): Promise<VipAccessCheckResponseDto> {
    const roomType = payload.roomType ?? VipRoomType.SNAKE_VIP;
    const result = await this.vipGameService.checkAccess(userId, roomType);
    return {
      canJoin: result.canJoin,
      credit: result.credit,
      ticket: result.ticket ? this.mapTicket(result.ticket) : undefined,
      config: result.config ? this.mapConfig(result.config) : undefined,
      reason: result.reason,
    };
  }

  @Post('rooms/vip/check-ticket')
  @UseGuards(InternalApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a VIP ticket for server-side admission' })
  @ApiResponse({ status: HttpStatus.OK, type: VipValidateTicketResponseDto })
  @ResponseMessage('VIP ticket validated successfully')
  async validateVipTicket(
    @Body() payload: VipValidateTicketRequestDto,
  ): Promise<VipValidateTicketResponseDto> {
    const result = await this.vipGameService.validateTicket(payload.ticketId);
    return {
      ticket: this.mapTicket(result.ticket),
      config: this.mapConfig(result.config),
      credit: result.credit,
    };
  }

  @Post('rooms/vip/consume')
  @UseGuards(InternalApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consume a VIP ticket once the player joins the room',
  })
  @ApiResponse({ status: HttpStatus.OK, type: VipConsumeTicketResponseDto })
  @ResponseMessage('VIP ticket consumed successfully')
  async consumeVipTicket(
    @Body() payload: VipConsumeTicketRequestDto,
  ): Promise<VipConsumeTicketResponseDto> {
    const result = await this.vipGameService.consumeTicket(
      payload.ticketId,
      payload.roomInstanceId,
    );

    return {
      credit: result.credit,
      ticket: this.mapTicket(result.ticket),
    };
  }

  @Post('vip/kill')
  @UseGuards(InternalApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process VIP kill reward and penalty' })
  @ApiResponse({ status: HttpStatus.OK, type: VipKillRewardResponseDto })
  @ResponseMessage('VIP kill reward processed successfully')
  async processVipKill(
    @Body() payload: VipKillRewardRequestDto,
  ): Promise<VipKillRewardResponseDto> {
    const result = await this.vipGameService.processKillReward({
      killerTicketId: payload.killerTicketId,
      victimTicketId: payload.victimTicketId,
      killReference: payload.killReference,
      roomInstanceId: payload.roomInstanceId,
    });

    return {
      killerCredit: result.killerCredit,
      victimCredit: result.victimCredit,
      rewardAmount: result.rewardAmount,
      feeAmount: result.feeAmount,
      alreadyProcessed: result.alreadyProcessed,
    };
  }

  @Post('vip/respawn')
  @UseGuards(InternalApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process respawn credit deduction for VIP players' })
  @ApiResponse({ status: HttpStatus.OK, type: VipRespawnResponseDto })
  @ResponseMessage('VIP respawn processed successfully')
  async processRespawn(
    @Body() payload: VipRespawnRequestDto,
  ): Promise<VipRespawnResponseDto> {
    const result = await this.vipGameService.processRespawn(payload.ticketId);
    return {
      credit: result.credit,
    };
  }

  private mapTicket(ticket: VipTicketEntity): VipTicketInfoDto {
    return {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      entryFee: ticket.entryFee,
      status: ticket.status,
      roomType: ticket.roomType,
      roomInstanceId: ticket.roomInstanceId,
      expiresAt: ticket.expiresAt,
      consumedAt: ticket.consumedAt,
    };
  }

  private mapConfig(config: VipRoomConfigEntity): VipRoomConfigDto {
    return {
      roomType: config.roomType,
      entryFee: config.entryFee,
      rewardRatePlayer: config.rewardRatePlayer,
      rewardRateTreasury: config.rewardRateTreasury,
      respawnCost: config.respawnCost,
      maxClients: config.maxClients,
      tickRate: config.tickRate,
      isActive: config.isActive,
      metadata: config.metadata ?? undefined,
    };
  }
}
