import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { MoreThanOrEqual, IsNull } from 'typeorm';
import { TJWTPayload } from '@/shared/types';
import { UserRepository, UserSessionRepository } from '@/database/repositories';
import { UserEntity } from '@/database/entities/user.entity';

const NONCE_KEY_PREFIX = 'auth:nonce';

export interface LoginTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  jwtId: string;
}

export interface LoginResult {
  user: UserEntity;
  tokens: LoginTokens;
}

@Injectable()
export class AuthService {
  private readonly nonceTtl: number;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly nonceMemoryStore = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.nonceTtl = Number(
      this.configService.get<number>('auth.nonce.ttl') ?? 120,
    );
    this.accessTtl = Number(
      this.configService.get<number>('auth.jwt.access_token_lifetime') ?? 900,
    );
    this.refreshTtl = Number(
      this.configService.get<number>('auth.jwt.refresh_token_lifetime') ??
        60 * 60 * 24 * 7,
    );
  }

  async generateNonce(walletAddress: string): Promise<{ nonce: string }> {
    const normalizedWallet = this.normalizeWallet(walletAddress);
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + this.nonceTtl * 1000;
    this.nonceMemoryStore.set(normalizedWallet, { value: nonce, expiresAt });
    const cacheKey = this.buildNonceCacheKey(normalizedWallet);
    const ttlMs = Math.max(1000, Math.floor(this.nonceTtl * 1000));
    try {
      await this.cacheManager.set(cacheKey, nonce, ttlMs);
    } catch (error) {
      // swallow cache errors, rely on memory store fallback
    }
    return { nonce };
  }

  async verifySignature(
    walletAddress: string,
    nonce: string,
    signature: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResult> {
    const normalizedWallet = this.normalizeWallet(walletAddress);
    await this.ensureNonceValid(normalizedWallet, nonce);
    this.verifyWalletSignature(normalizedWallet, nonce, signature);

    let user = await this.userRepository.findOne({
      where: { walletAddress: normalizedWallet },
    });

    if (!user) {
      user = this.userRepository.create({
        walletAddress: normalizedWallet,
        displayName: normalizedWallet.slice(0, 8),
      });
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const tokens = await this.issueTokens(user, metadata);
    await this.clearNonce(normalizedWallet);

    return {
      user,
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const hashedToken = this.hashRefreshToken(refreshToken);
    const session = await this.userSessionRepository.findOne({
      where: {
        refreshToken: hashedToken,
        revokedAt: IsNull(),
        expiresAt: MoreThanOrEqual(new Date()),
      },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokens(session.user, {
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
    });

    session.revokedAt = new Date();
    await this.userSessionRepository.save(session);

    return {
      user: session.user,
      tokens,
    };
  }

  async revokeSession(jwtId: string, userId: string, revokeAll = false) {
    const now = new Date();

    if (revokeAll) {
      await this.userSessionRepository
        .createQueryBuilder()
        .update()
        .set({ revokedAt: now })
        .where('user_id = :userId', { userId })
        .andWhere('revoked_at IS NULL')
        .execute();
      return;
    }

    await this.userSessionRepository
      .createQueryBuilder()
      .update()
      .set({ revokedAt: now })
      .where('user_id = :userId', { userId })
      .andWhere('jwt_id = :jwtId', { jwtId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async issueTokens(
    user: UserEntity,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginTokens> {
    const jwtId = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtl * 1000);
    const refreshToken = randomUUID();
    const payload: TJWTPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      jti: jwtId,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.accessTtl,
    });

    const session = this.userSessionRepository.create({
      user,
      jwtId,
      refreshToken: this.hashRefreshToken(refreshToken),
      expiresAt,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    });

    await this.userSessionRepository.save(session);

    return {
      accessToken,
      expiresIn: this.accessTtl,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      jwtId,
    };
  }

  private buildNonceCacheKey(walletAddress: string): string {
    return `${NONCE_KEY_PREFIX}:${walletAddress}`;
  }

  private normalizeWallet(walletAddress: string): string {
    if (!walletAddress) {
      throw new BadRequestException('Wallet address is required');
    }
    return walletAddress.trim();
  }

  private async ensureNonceValid(walletAddress: string, nonce: string) {
    const now = Date.now();
    const entry = this.nonceMemoryStore.get(walletAddress);
    if (entry) {
      if (entry.expiresAt < now) {
        this.nonceMemoryStore.delete(walletAddress);
      } else if (entry.value === nonce) {
        return;
      }
    }

    const cacheKey = this.buildNonceCacheKey(walletAddress);
    try {
      const cachedNonce = await this.cacheManager.get<string>(cacheKey);
      if (cachedNonce && cachedNonce === nonce) {
        return;
      }
    } catch (error) {
      // ignore cache errors, fallback to memory store check only
    }

    throw new UnauthorizedException('Nonce is invalid or expired');
  }

  private async clearNonce(walletAddress: string) {
    this.nonceMemoryStore.delete(walletAddress);
    try {
      await this.cacheManager.del(this.buildNonceCacheKey(walletAddress));
    } catch (error) {
      // ignore cache errors
    }
  }

  private verifyWalletSignature(
    walletAddress: string,
    nonce: string,
    signature: string,
  ) {
    try {
      const publicKey = new PublicKey(walletAddress);
      const signatureBytes = bs58.decode(signature);
      const messageBytes = new TextEncoder().encode(nonce);
      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes(),
      );
      if (!isValid) {
        throw new UnauthorizedException('Signature verification failed');
      }
    } catch (error) {
      throw new UnauthorizedException('Signature verification failed');
    }
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
