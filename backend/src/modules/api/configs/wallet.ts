import { registerAs } from '@nestjs/config';

export const configWallet = registerAs('wallet', () => ({
  tokenMint: process.env.WALLET_DEPOSIT_TOKEN_MINT ?? '',
  tokenDecimals: Number(process.env.WALLET_TOKEN_DECIMALS ?? 6),
  webhookSecret: process.env.WALLET_WEBHOOK_SECRET,
  paymentTransferUrl: process.env.WALLET_PAYMENT_BASE_URL ?? '',
}));
