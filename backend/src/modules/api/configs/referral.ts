import { registerAs } from '@nestjs/config';

export const configReferral = registerAs('referral', () => ({
  gameKillCommissionRate:
    Number(process.env.REFERRAL_GAME_KILL_COMMISSION_RATE) || 0.02,
  gameDeathCommissionRate:
    Number(process.env.REFERRAL_GAME_DEATH_COMMISSION_RATE) || 0.01,
  commissionCapPerUser:
    Number(process.env.REFERRAL_COMMISSION_CAP_PER_USER) || 100.0,
  codeLength: Number(process.env.REFERRAL_CODE_LENGTH) || 8,
}));

