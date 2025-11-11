import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthResponseDto,
  AuthTokensDto,
  AuthUserDto,
  LogoutRequestDto,
  NonceRequestDto,
  RefreshTokenDto,
  VerifySignatureDto,
} from '@/api/dtos';
import { AuthService } from '@/business/services';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { JwtAuthGuard } from '@/api/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserId } from '@/api/decorator/user.decorator';
import { LoginResult } from '@/business/services/auth.service';
import { Request } from 'express';
import { TJWTPayload } from '@/shared/types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate nonce for wallet signature' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Nonce generated successfully',
  })
  @ResponseMessage('Nonce generated successfully')
  async createNonce(@Body() payload: NonceRequestDto) {
    return this.authService.generateNonce(payload.walletAddress);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify wallet signature and issue tokens' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Signature verified and tokens issued',
    type: AuthResponseDto,
  })
  @ResponseMessage('Login successful')
  async verifySignature(
    @Body() payload: VerifySignatureDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.verifySignature(
      payload.walletAddress,
      payload.nonce,
      payload.signature,
      {
        userAgent: request.headers['user-agent'] ?? undefined,
        ipAddress: request.ip,
      },
    );
    return this.mapLoginResult(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens refreshed successfully',
    type: AuthResponseDto,
  })
  @ResponseMessage('Token refreshed successfully')
  async refreshToken(
    @Body() payload: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.refresh(payload.refreshToken);
    return this.mapLoginResult(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke current session or all sessions' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Logout successful' })
  @ResponseMessage('Logout successful')
  async logout(
    @CurrentUserId() userId: string,
    @CurrentUser() payload: TJWTPayload,
    @Body() body: LogoutRequestDto,
  ): Promise<{ success: boolean }> {
    await this.authService.revokeSession(
      payload.jti,
      userId,
      body.logoutAll ?? false,
    );
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthUserDto })
  @ResponseMessage('Profile retrieved successfully')
  async profile(@CurrentUserId() userId: string) {
    const user = await this.authService.getProfile(userId);
    return this.mapUser(user);
  }

  private mapLoginResult(result: LoginResult): AuthResponseDto {
    return {
      user: this.mapUser(result.user),
      tokens: this.mapTokens(result.tokens),
    };
  }

  private mapUser(user: LoginResult['user']): AuthUserDto {
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }

  private mapTokens(tokens: LoginResult['tokens']): AuthTokensDto {
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
    };
  }
}
