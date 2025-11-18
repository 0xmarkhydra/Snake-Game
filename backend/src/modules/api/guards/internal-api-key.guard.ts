import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly expectedKey: string;

  constructor(private readonly configService: ConfigService) {
    this.expectedKey =
      this.configService.get<string>('game.internalApiKey') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedKey) {
      throw new UnauthorizedException('Internal API key is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey =
      request.headers['x-internal-key'] ??
      request.headers['X-Internal-Key'] ??
      request.headers['x-internal-api-key'];

    if (typeof providedKey !== 'string') {
      throw new UnauthorizedException('Missing internal API key');
    }

    if (providedKey !== this.expectedKey) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
