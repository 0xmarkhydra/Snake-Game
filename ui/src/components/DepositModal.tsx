import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, VaultSDK } from '@solana-payment/sdk';
import { authService } from '../services/AuthService';
import { walletService } from '../services/WalletService';
import { apiService } from '../services/ApiService';
import type { PhantomProvider } from '../types/Auth.types';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess: () => void;
  initialMessage?: string;
}

interface DepositMetadata {
  raw: Record<string, unknown>;
  tokenMint: string;
  decimals: number;
  amount: number;
  memo?: string;
  referenceCode?: string;
}

const DEFAULT_RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

export const DepositModal = ({ isOpen, onClose, onDepositSuccess, initialMessage }: DepositModalProps) => {
  const [amount, setAmount] = useState('1');
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState('text-yellow-300');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentCredit, setCurrentCredit] = useState('0.00');

  useEffect(() => {
    if (isOpen) {
      const credit = walletService.getCachedCredit();
      setCurrentCredit(walletService.formatCredit(credit));
      setStatusText(initialMessage || 'Enter the amount and press Deposit.');
      setStatusColor('text-yellow-300');
    }
  }, [isOpen, initialMessage]);

  const handleDeposit = async () => {
    if (isProcessing) return;

    const walletAddress = authService.getWalletAddress();
    if (!walletAddress) {
      setStatusColor('text-red-400');
      setStatusText('Wallet not found. Please connect Phantom first.');
      return;
    }

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setStatusColor('text-red-400');
      setStatusText('Amount must be greater than 0.');
      return;
    }

    const provider = getPhantomProvider();
    if (!provider?.publicKey || typeof provider.signTransaction !== 'function') {
      setStatusColor('text-red-400');
      setStatusText('Phantom wallet is not available. Please reconnect.');
      return;
    }

    try {
      setIsProcessing(true);
      const previousCredit = walletService.getCachedCredit();

      setStatusColor('text-yellow-300');
      setStatusText('Generating deposit metadata...');

      const response = await apiService.post('/wallet/deposit', {
        walletAddress,
        amount: amountNum
      });

      const metadata = extractDepositMetadata(response, amountNum);
      if (!metadata.tokenMint) {
        throw new Error('Token mint is missing in metadata.');
      }

      setStatusText('Building transaction...');

      const connection = new Connection(DEFAULT_RPC_ENDPOINT, 'confirmed');
      const sdk = new VaultSDK({ connection, programId: PROGRAM_ID });

      const mint = new PublicKey(metadata.tokenMint);
      const rawAmount = Math.round(metadata.amount * (10 ** metadata.decimals));

      const transaction = await sdk.buildDepositTransaction({
        amount: rawAmount,
        user: provider.publicKey,
        mint,
      });

      transaction.feePayer = provider.publicKey;
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      setStatusText('Signing transaction in Phantom...');
      const signed = await provider.signTransaction(transaction);

      setStatusText('Sending transaction to Solana...');
      const signature = await connection.sendRawTransaction(signed.serialize());

      setStatusText('Confirming transaction...');
      await connection.confirmTransaction(signature, 'confirmed');

      const solscanUrl = getSolscanTxUrl(signature);
      setStatusText(`Checking credit balance...`);

      const newCredit = await walletService.getCredit();
      const formattedCredit = walletService.formatCredit(newCredit);
      setCurrentCredit(formattedCredit);

      if (newCredit > previousCredit) {
        showDepositSuccess(signature, solscanUrl, formattedCredit);
      } else {
        await pollCreditForUpdate(previousCredit, signature, solscanUrl);
      }
    } catch (error: any) {
      console.error('Deposit failed', error);
      setStatusColor('text-red-400');
      const message = error?.message ?? 'Deposit failed. Please try again.';
      setStatusText(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const pollCreditForUpdate = async (previousCredit: number, signature: string, solscanUrl: string) => {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await delay(3000);
      const refreshedCredit = await walletService.getCredit();
      const formattedCredit = walletService.formatCredit(refreshedCredit);
      setCurrentCredit(formattedCredit);

      if (refreshedCredit > previousCredit) {
        showDepositSuccess(signature, solscanUrl, formattedCredit);
        return;
      }

      const remaining = maxAttempts - attempt - 1;
      const waitingMessage =
        remaining > 0
          ? `Waiting for credit update... (${remaining} more tries)`
          : 'Waiting for credit update...';
      setStatusText(waitingMessage);
    }

    setStatusColor('text-red-400');
    setStatusText('Credit has not updated yet. Check Solscan for transaction status. You can still join VIP manually once credit updates.');
  };

  const showDepositSuccess = (signature: string, _solscanUrl: string, formattedCredit: string) => {
    setStatusColor('text-green-400');
    setStatusText(`✅ Deposit confirmed! 🎉\nNew Balance: ${formattedCredit} USDC\nTx: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
    setTimeout(() => {
      onDepositSuccess();
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onClick={() => !isProcessing && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="bg-gradient-to-br from-[#0a1f2e] via-[#0d2838] to-[#081d28] rounded-2xl border-2 border-game-blue/60 shadow-2xl shadow-game-blue/30 p-6 sm:p-8 max-w-md w-full relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Animated Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5 animate-pulse pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-2xl z-10 disabled:opacity-50"
          >
            ✕
          </button>

          {/* Header */}
          <div className="text-center mb-6 relative z-10">
            <div className="text-5xl mb-3 animate-pulse">💰</div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 mb-2">
              Deposit USDC
            </h2>
            <p className="text-sm text-gray-400">
              Current: <span className="text-game-gold font-bold">{currentCredit} USDC</span>
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4 relative z-10">
            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Amount (USDC)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.000001"
                min="0.000001"
                disabled={isProcessing}
                className="w-full px-4 py-3 bg-game-blue/10 border-2 border-game-blue/30 rounded-lg text-white placeholder-gray-500 focus:border-game-blue focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg font-bold"
              />
            </div>

            {/* Status Message */}
            <motion.div
              key={statusText}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-center text-sm font-semibold ${statusColor} min-h-[60px] flex items-center justify-center whitespace-pre-line`}
            >
              {statusText}
            </motion.div>

            {/* Deposit Button */}
            <motion.button
              onClick={handleDeposit}
              disabled={isProcessing}
              whileHover={{ scale: isProcessing ? 1 : 1.02 }}
              whileTap={{ scale: isProcessing ? 1 : 0.98 }}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-black text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/30 relative overflow-hidden group"
            >
              {/* Button Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-white/20 to-emerald-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              
              <span className="relative z-10">
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </span>
                ) : (
                  '💰 Deposit Now'
                )}
              </span>
            </motion.button>

            {/* Info Note */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-xs text-green-300">
              <span className="font-bold">ℹ️ Info:</span> Your wallet will be charged for the deposit amount plus Solana network fees. Credit updates may take a few moments.
            </div>
          </div>

          {/* Corner Decorations */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full blur-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-tr-full blur-xl pointer-events-none" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Helper functions
function getPhantomProvider(): (PhantomProvider & { publicKey?: PublicKey; signTransaction?: (transaction: any) => Promise<any> }) | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const provider = window.solana as (PhantomProvider & { publicKey?: PublicKey; signTransaction?: (transaction: any) => Promise<any> }) | undefined;
  if (provider?.isPhantom) {
    return provider;
  }

  const legacyProvider = window.phantom?.solana as (PhantomProvider & { publicKey?: PublicKey; signTransaction?: (transaction: any) => Promise<any> }) | undefined;
  if (legacyProvider) {
    return legacyProvider;
  }

  return null;
}

function extractDepositMetadata(response: any, fallbackAmount: number): DepositMetadata {
  const payload = (response?.data ?? response) as Record<string, unknown>;
  const rawMetadata = (payload?.['metadata'] ?? payload) as Record<string, unknown>;

  const tokenMint = String(rawMetadata.tokenMint ?? rawMetadata.mint ?? '');
  const decimalsValue = Number(
    rawMetadata.decimals ??
    rawMetadata.decimal ??
    payload?.['decimals'] ??
    payload?.['decimal'] ??
    6
  );
  const amountValue = Number(
    rawMetadata.amount ??
    rawMetadata.value ??
    rawMetadata.rawAmount ??
    rawMetadata.formattedAmount ??
    payload?.['amount'] ??
    payload?.['value'] ??
    payload?.['rawAmount'] ??
    fallbackAmount
  );

  const memo = String(rawMetadata.memo ?? payload?.['memo'] ?? '');
  const referenceCode = String(rawMetadata.referenceCode ?? payload?.['referenceCode'] ?? '');

  return {
    raw: rawMetadata,
    tokenMint,
    decimals: Number.isNaN(decimalsValue) ? 6 : decimalsValue,
    amount: Number.isNaN(amountValue) ? fallbackAmount : amountValue,
    memo: memo || undefined,
    referenceCode: referenceCode || undefined
  };
}

function getSolscanTxUrl(signature: string): string {
  const endpoint = (DEFAULT_RPC_ENDPOINT || 'https://api.devnet.solana.com').toLowerCase();
  const cluster = endpoint.includes('devnet') ? 'devnet' : endpoint.includes('testnet') ? 'testnet' : 'mainnet-beta';
  const suffix = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${signature}${suffix}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

