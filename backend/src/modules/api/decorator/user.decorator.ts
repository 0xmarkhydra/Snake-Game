import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TJWTPayload } from '@/shared/types';

const buildFallbackUser = (): TJWTPayload => ({
  sub: '27afb6cc-6533-4a81-a820-269b74f92476',
  walletAddress: 'LOCAL_WALLET_PLACEHOLDER',
  jti: 'local-jti-placeholder',
});

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TJWTPayload | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request?.user as TJWTPayload | undefined;
    if (!user && process.env.APP_ENV === 'local') {
      return buildFallbackUser();
    }
    return user ?? null;
  },
);

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request?.user as TJWTPayload | undefined;
    if (!user && process.env.APP_ENV === 'local') {
      return buildFallbackUser().sub;
    }
    return user?.sub ?? null;
  },
);
