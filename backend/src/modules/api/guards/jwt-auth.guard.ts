import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { TJWTPayload } from '@/shared/types';
import { UserSessionRepository } from '@/database/repositories';
import { IsNull, MoreThan } from 'typeorm';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userSessionRepository: UserSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }

    try {
      const payload = await this.jwtService.verifyAsync<TJWTPayload>(token, {
        secret: this.configService.get<string>('auth.jwt.jwt_secret_key'),
      });

      const session = await this.userSessionRepository.findOne({
        where: {
          jwtId: payload.jti,
          user: {
            id: payload.sub,
          },
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        relations: ['user'],
      });

      if (!session) {
        throw new UnauthorizedException('Session revoked or expired');
      }

      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Unauthorized');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
