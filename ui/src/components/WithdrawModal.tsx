import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletService } from '../services/WalletService';
import { authService } from '../services/AuthService';
import { fireWithdrawConfetti } from '../utils/confetti';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdrawSuccess: () => void;
  onShowAmountEffect?: (amount: number) => void;
}

export const WithdrawModal = ({ isOpen, onClose, onWithdrawSuccess, onShowAmountEffect }: WithdrawModalProps) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [statusText, setStatusText] = useState('Enter the amount to cash out to your connected Phantom wallet.');
  const [statusColor, setStatusColor] = useState('text-[#989898]');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentCredit, setCurrentCredit] = useState('0.00');
  const [retryCountdown, setRetryCountdown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const credit = walletService.getCachedCredit();
      setCurrentCredit(walletService.formatCredit(credit));
      const connectedWallet = authService.getWalletAddress() || '';
      setWalletAddress(connectedWallet);

      if (connectedWallet) {
        setStatusColor('text-[#989898]');
        setStatusText('Enter the amount to cash out to your connected Phantom wallet.');
      } else {
        setStatusColor('text-red-400');
        setStatusText('Connect your Phantom wallet to cash out.');
      }
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

  const handleWithdraw = async () => {
    if (isProcessing || retryCountdown > 0) return;

    const connectedWallet = authService.getWalletAddress() || '';
    if (!connectedWallet) {
      setStatusColor('text-red-400');
      setStatusText('Phantom wallet not connected. Please connect and try again.');
      return;
    }

    setWalletAddress(connectedWallet);

    // Validate amount
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setStatusColor('text-red-400');
      setStatusText('Amount must be greater than 0.');
      return;
    }

    // Real flow: check balance and call withdraw API
    const currentBalance = walletService.getCachedCredit();
    if (amountNum > currentBalance) {
      setStatusColor('text-red-400');
      setStatusText(`Insufficient balance. Available: ${walletService.formatCredit(currentBalance)} USDC`);
      return;
    }

    try {
      setIsProcessing(true);
      setStatusColor('text-yellow-300');
      setStatusText('Processing cash out...');

      const result = await walletService.withdraw(connectedWallet, amountNum);

      if (result.success) {
        setStatusColor('text-green-400');
        setStatusText(`✅ Cash Out successful! ${amountNum} USDC sent to ${authService.formatWalletAddress(connectedWallet)}.`);
        
        // Update current credit display
        const newCredit = walletService.getCachedCredit();
        setCurrentCredit(walletService.formatCredit(newCredit));

        // Fire celebratory confetti from bottom of the screen
        fireWithdrawConfetti();

        if (onShowAmountEffect) {
          onShowAmountEffect(amountNum);
        }

        // Close modal after 2 seconds
        setTimeout(() => {
          onWithdrawSuccess();
          onClose();
        }, 2000);
      } else {
        setStatusColor('text-red-400');
        setStatusText(result.message || 'Cash Out failed. Please try again.');
        
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

  const isWithdrawDisabled = isProcessing || retryCountdown > 0 || !walletAddress;
  const formattedWallet = walletAddress ? authService.formatWalletAddress(walletAddress) : 'Not connected';

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
          className="bg-[#FFFFFF] rounded-[30px] border-2 border-[#FFFFFF] shadow-2xl shadow-game-blue/30 p-6 sm:p-8 max-w-md w-full relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >

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
            <img src="/images/USDC2.jpg" alt="USDC" className="w-20 h-20 mx-auto mb-3 object-contain" />
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-3xl font-black text-[#12B900]">Cash Out USDC</h2>
              <img src="/images/iconUsdc.png" alt="USDC" className="w-7 h-7" />
            </div>
            <p className="text-sm text-[#5F5F5F] flex items-center justify-center gap-1">
              <span>Available:</span>
              <span className="font-bold text-[#5F5F5F] flex items-center gap-1">
                {currentCredit}
                <img src="/images/iconUsdc.png" alt="USDC" className="w-4 h-4" />
              </span>
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4 relative z-10">
            {/* Destination Wallet */}
            <div>
              <label className="block text-xs font-semibold text-[#5F5F5F] mb-2 text-center">Destination Wallet</label>
              <div className="w-full px-4 py-3 bg-[#0B2332]/10 border-2 border-[#0B2332]/30 rounded-[30px] text-[#5F5F5F] font-mono text-sm">
                {formattedWallet}
              </div>
              <p className="text-xs text-[#5F5F5F] mt-2 text-center">
                Funds will be cashed out to your connected Phantom wallet.
              </p>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-[#5F5F5F] mb-2 text-center">Amount (USDC)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.000001"
                  min="0"
                  disabled={isProcessing || retryCountdown > 0}
                  className="w-full px-4 py-3 pr-20 bg-[#0B2332]/10 border-2 border-[#0B2332]/30 rounded-[30px] text-[#0B2332] placeholder-[#0B2332]/60 focus:border-[#0B2332] focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg font-bold"
                />
                <button
                  onClick={handleMaxAmount}
                  disabled={isProcessing || retryCountdown > 0}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#12B900]/15 hover:bg-[#12B900]/25 border border-[#12B900]/40 rounded text-[#12B900] text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={isWithdrawDisabled}
              whileHover={{ scale: isWithdrawDisabled ? 1 : 1.02 }}
              whileTap={{ scale: isWithdrawDisabled ? 1 : 0.98 }}
              className="w-full py-4 px-6 rounded-[30px] bg-gradient-to-r from-[#0CBF4B] to-[#12B900] hover:from-[#0AAA40] hover:to-[#0FA800] text-white font-black text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#0CBF4B]/30 relative overflow-hidden group"
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
                  'Cash Out Now'
                )}
              </span>
            </motion.button>

            {/* Warning Note */}
            <div className="bg-white/5 border border-[#E1E1E1] rounded-[30px] p-3 text-xs text-[#5F5F5F] font-SFPro">
              <span className="font-bold text-[#5F5F5F]">⚠️ Note:</span> Cast Out is irreversible. Ensure your Phantom wallet remains connected and secure before confirming.
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

