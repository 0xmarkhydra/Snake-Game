import { registerAs } from '@nestjs/config';

export const configAuth = registerAs('auth', () => ({
  jwt: {
    jwt_secret_key: process.env.JWT_SECRET_KEY || 'jwt-secret',
    access_token_lifetime:
      Number(process.env.JWT_ACCESS_TOKEN_LIFETIME) || 15 * 60,
    refresh_token_lifetime:
      Number(process.env.JWT_REFRESH_TOKEN_LIFETIME) || 7 * 24 * 60 * 60,
  },
  nonce: {
    ttl: Number(process.env.AUTH_NONCE_TTL) || 120,
  },
}));
