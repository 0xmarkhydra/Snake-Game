import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletService } from '../services/WalletService';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdrawSuccess: () => void;
}

export const WithdrawModal = ({ isOpen, onClose, onWithdrawSuccess }: WithdrawModalProps) => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState('text-yellow-300');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentCredit, setCurrentCredit] = useState('0.00');
  const [retryCountdown, setRetryCountdown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const credit = walletService.getCachedCredit();
      setCurrentCredit(walletService.formatCredit(credit));
      setStatusText('Enter recipient address and amount to withdraw.');
      setStatusColor('text-yellow-300');
      setRecipientAddress('');
      setAmount('');
      setRetryCountdown(0);
    }
  }, [isOpen]);

  // Countdown timer for retry
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown(retryCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

  const validateSolanaAddress = (address: string): boolean => {
    // Basic Solana address validation (32-44 base58 characters)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return solanaAddressRegex.test(address);
  };

  const handleWithdraw = async () => {
    if (isProcessing || retryCountdown > 0) return;

    // Validate recipient address
    if (!recipientAddress.trim()) {
      setStatusColor('text-red-400');
      setStatusText('Please enter recipient wallet address.');
      return;
    }

    if (!validateSolanaAddress(recipientAddress.trim())) {
      setStatusColor('text-red-400');
      setStatusText('Invalid Solana wallet address format.');
      return;
    }

    // Validate amount
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setStatusColor('text-red-400');
      setStatusText('Amount must be greater than 0.');
      return;
    }

    const currentBalance = walletService.getCachedCredit();
    if (amountNum > currentBalance) {
      setStatusColor('text-red-400');
      setStatusText(`Insufficient balance. Available: ${walletService.formatCredit(currentBalance)} USDC`);
      return;
    }

    try {
      setIsProcessing(true);
      setStatusColor('text-yellow-300');
      setStatusText('Processing withdrawal...');

      const result = await walletService.withdraw(recipientAddress.trim(), amountNum);

      if (result.success) {
        setStatusColor('text-green-400');
        setStatusText(`✅ Withdrawal successful! ${amountNum} USDC sent to ${recipientAddress.slice(0, 8)}...`);
        
        // Update current credit display
        const newCredit = walletService.getCachedCredit();
        setCurrentCredit(walletService.formatCredit(newCredit));

        // Close modal after 2 seconds
        setTimeout(() => {
          onWithdrawSuccess();
          onClose();
        }, 2000);
      } else {
        setStatusColor('text-red-400');
        setStatusText(result.message || 'Withdrawal failed. Please try again.');
        
        // Handle retry countdown
        if (result.retryAfter) {
          setRetryCountdown(result.retryAfter);
        }
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      setStatusColor('text-red-400');
      setStatusText('Unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMaxAmount = () => {
    const credit = walletService.getCachedCredit();
    setAmount(credit.toString());
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
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
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5 animate-pulse pointer-events-none" />

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
            <div className="text-5xl mb-3 animate-pulse">💸</div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 mb-2">
              Withdraw USDC
            </h2>
            <p className="text-sm text-gray-400">
              Available: <span className="text-game-gold font-bold">{currentCredit} USDC</span>
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4 relative z-10">
            {/* Recipient Address Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Recipient Wallet Address
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter Solana wallet address..."
                disabled={isProcessing || retryCountdown > 0}
                className="w-full px-4 py-3 bg-game-blue/10 border-2 border-game-blue/30 rounded-lg text-white placeholder-gray-500 focus:border-game-blue focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.000001"
                  min="0"
                  disabled={isProcessing || retryCountdown > 0}
                  className="w-full px-4 py-3 pr-20 bg-game-blue/10 border-2 border-game-blue/30 rounded-lg text-white placeholder-gray-500 focus:border-game-blue focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg font-bold"
                />
                <button
                  onClick={handleMaxAmount}
                  disabled={isProcessing || retryCountdown > 0}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-game-gold/20 hover:bg-game-gold/30 border border-game-gold/50 rounded text-game-gold text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Status Message */}
            <motion.div
              key={statusText}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-center text-sm font-semibold ${statusColor} min-h-[40px] flex items-center justify-center`}
            >
              {statusText}
            </motion.div>

            {/* Withdraw Button */}
            <motion.button
              onClick={handleWithdraw}
              disabled={isProcessing || retryCountdown > 0}
              whileHover={{ scale: isProcessing || retryCountdown > 0 ? 1 : 1.02 }}
              whileTap={{ scale: isProcessing || retryCountdown > 0 ? 1 : 0.98 }}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-black text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-red-500/30 relative overflow-hidden group"
            >
              {/* Button Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-400/0 via-white/20 to-orange-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              
              <span className="relative z-10">
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </span>
                ) : retryCountdown > 0 ? (
                  `Wait ${retryCountdown}s...`
                ) : (
                  '💸 Withdraw Now'
                )}
              </span>
            </motion.button>

            {/* Warning Note */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-xs text-orange-300">
              <span className="font-bold">⚠️ Note:</span> Withdrawal is irreversible. Please double-check the recipient address before confirming.
            </div>
          </div>

          {/* Corner Decorations */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full blur-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/10 rounded-tr-full blur-xl pointer-events-none" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

