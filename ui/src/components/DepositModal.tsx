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

  const showDepositSuccess = (signature: string, solscanUrl: string, formattedCredit: string) => {
    setStatusColor('text-green-400');
    setStatusText(`Deposit confirmed! 🎉\nCredit: ${formattedCredit}\nTx: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
    setTimeout(() => {
      onDepositSuccess();
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    if (!isProcessing) {
      setStatusText('');
      setAmount('1');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'backOut' }}
            className="fixed inset-0 z-[2001] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-[#0b2a6b]/96 backdrop-blur-sm rounded-2xl border-2 border-[#52a8ff]/85 p-8 w-[420px] max-w-[90vw] pointer-events-auto shadow-2xl">
              {/* Title */}
              <h2 className="text-2xl font-bold text-white text-center mb-2">
                Deposit Tokens
              </h2>

              {/* Current Credit */}
              <p className="text-sm text-[#9ad6ff] text-center mb-6">
                Current credit: {currentCredit} credit
              </p>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm text-white mb-2">Amount</label>
                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 rounded-lg border-2 border-game-blue bg-[#081c3c]/90 text-white text-base outline-none focus:border-game-light focus:ring-2 focus:ring-game-light/50 transition-all disabled:opacity-50"
                />
              </div>

              {/* Status Text */}
              {statusText && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm ${statusColor} text-center mb-6 leading-relaxed whitespace-pre-line min-h-[54px] p-3 bg-black/20 rounded-lg`}
                >
                  {statusText}
                </motion.div>
              )}

              {/* Buttons */}
              <div className="space-y-3">
                <motion.button
                  onClick={handleDeposit}
                  disabled={isProcessing}
                  whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                  whileTap={{ scale: isProcessing ? 1 : 0.98 }}
                  className="w-full bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
                >
                  {isProcessing ? 'Processing...' : 'Deposit'}
                </motion.button>

                <motion.button
                  onClick={handleClose}
                  disabled={isProcessing}
                  whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                  whileTap={{ scale: isProcessing ? 1 : 0.98 }}
                  className="w-full bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
                >
                  Close
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
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

