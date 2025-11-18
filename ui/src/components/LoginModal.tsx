import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/AuthService';
import { walletService } from '../services/WalletService';
import { referralService } from '../services/ReferralService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  onShowDeposit: () => void;
}

export const LoginModal = ({ isOpen, onClose, onLoginSuccess, onShowDeposit }: LoginModalProps) => {
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState('text-yellow-300');
  const [isProcessing, setIsProcessing] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralCodeValid, setReferralCodeValid] = useState<boolean | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);

  // Load referral code from URL on mount
  useEffect(() => {
    if (isOpen) {
      const refCode = referralService.getReferralCodeFromUrl();
      if (refCode) {
        setReferralCode(refCode.toUpperCase());
        setReferralCodeValid(true);
      }
    }
  }, [isOpen]);

  // Validate referral code when it changes
  useEffect(() => {
    if (referralCode && referralCode.length >= 1) {
      const timeoutId = setTimeout(async () => {
        setIsValidatingReferral(true);
        try {
          const result = await referralService.validateReferralCode(referralCode.toUpperCase());
          setReferralCodeValid(result.valid);
        } catch (error) {
          setReferralCodeValid(false);
        } finally {
          setIsValidatingReferral(false);
        }
      }, 500); // Debounce 500ms

      return () => clearTimeout(timeoutId);
    } else {
      setReferralCodeValid(null);
    }
  }, [referralCode]);

  const handleConnect = async () => {
    if (isProcessing) return;

    // Validate referral code if provided
    if (referralCode && referralCodeValid === false) {
      setStatusColor('text-red-400');
      setStatusText('Invalid referral code. Please check and try again.');
      return;
    }

    try {
      setIsProcessing(true);
      setStatusColor('text-yellow-300');
      setStatusText('Connecting Wallet...');

      // Use referral code if valid
      const refCode = referralCode && referralCodeValid ? referralCode.toUpperCase() : undefined;
      await authService.login(refCode);
      setStatusText('Login successful! Checking credit...');

      walletService.startPolling(3000);

      const credit = await walletService.getCredit();
      if (credit >= 1) {
        setStatusColor('text-green-400');
        setStatusText('Login successful! You are ready to play VIP. Click PLAY VIP to join.');
        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 1200);
      } else {
        setStatusColor('text-yellow-300');
        setStatusText('Credit is still below the requirement. Please deposit to join VIP rooms.');
        setTimeout(() => {
          onClose();
          onShowDeposit();
        }, 400);
      }
    } catch (error: any) {
      console.error('Connect Wallet failed', error);
      setStatusColor('text-red-400');
      const message = error?.message || 'Kết nối thất bại. Vui lòng thử lại.';
      setStatusText(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setStatusText('');
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
            <div className="bg-game-dark/95 backdrop-blur-sm rounded-2xl border-3 border-game-blue/80 p-8 w-[420px] max-w-[90vw] pointer-events-auto">
              {/* Title */}
              <h2 className="text-2xl font-bold text-white text-center mb-4">
                Play VIP requires Connect Wallet
              </h2>

              {/* Description */}
              <p className="text-sm text-[#9ad6ff] text-center mb-4 leading-relaxed">
                Connect wallet to join VIP rooms and receive rewards.
              </p>

              {/* Referral Code Input */}
              <div className="mb-4">
                <label className="block text-sm text-[#9ad6ff] mb-2">
                  Referral Code (Optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Enter referral code"
                    maxLength={16}
                    disabled={isProcessing}
                    className={`w-full bg-game-dark/50 border-2 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                      referralCodeValid === false
                        ? 'border-red-500 focus:ring-red-500'
                        : referralCodeValid === true
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-game-blue/50 focus:ring-game-blue'
                    }`}
                  />
                  {isValidatingReferral && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-[#9ad6ff] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {referralCode && !isValidatingReferral && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {referralCodeValid === true ? (
                        <span className="text-green-500 text-lg">✓</span>
                      ) : referralCodeValid === false ? (
                        <span className="text-red-500 text-lg">✗</span>
                      ) : null}
                    </div>
                  )}
                </div>
                {referralCode && referralCodeValid === false && (
                  <p className="text-xs text-red-400 mt-1">Invalid referral code</p>
                )}
                {referralCode && referralCodeValid === true && (
                  <p className="text-xs text-green-400 mt-1">Valid referral code</p>
                )}
              </div>

              {/* Status Text */}
              {statusText && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm ${statusColor} text-center mb-6 leading-relaxed whitespace-pre-line min-h-[60px]`}
                >
                  {statusText}
                </motion.p>
              )}

              {/* Buttons */}
              <div className="space-y-3">
                <motion.button
                  onClick={handleConnect}
                  disabled={isProcessing}
                  whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                  whileTap={{ scale: isProcessing ? 1 : 0.98 }}
                  className="w-full bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl border-2 border-white/90 transition-all duration-200"
                >
                  {isProcessing ? 'Processing...' : 'Connect Wallet'}
                </motion.button>

                <motion.button
                  onClick={handleClose}
                  disabled={isProcessing}
                  whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                  whileTap={{ scale: isProcessing ? 1 : 0.98 }}
                  className="w-full bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl border-2 border-gray-500 transition-all duration-200"
                >
                  Later
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

