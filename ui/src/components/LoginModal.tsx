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

  // Load referral code from URL on mount
  useEffect(() => {
    if (isOpen) {
      const refCode = referralService.getReferralCodeFromUrl();
      if (refCode) {
        setReferralCode(refCode.toUpperCase());
      }
    }
  }, [isOpen]);

  const handleConnect = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setStatusColor('text-yellow-300');
      setStatusText('Connecting Wallet...');

      // Use referral code if provided
      const refCode = referralCode ? referralCode.toUpperCase() : undefined;
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
      const message = error?.message || 'Connection failed. Please try again.';
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
            className="fixed inset-0 bg-black/30 backdrop-blur-[8px] z-[2000] flex items-center justify-center"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'backOut' }}
            className="fixed inset-0 z-[2001] flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[700px] px-4">
              <div
                className="relative w-full bg-no-repeat bg-center bg-contain px-8 sm:px-10 pb-10 pt-12 flex flex-col items-center"
                style={{
                  backgroundImage: "url('/images/Wallet.png')",
                  minHeight: '620px',
                }}
              >
                <div className="w-full space-y-5 flex flex-col items-center" style={{ marginTop: '250px' }}>
                  {/* Status Text */}
                  {statusText && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-sm ${statusColor} text-center leading-relaxed whitespace-pre-line min-h-[60px]`}
                    >
                      {statusText}
                    </motion.p>
                  )}

                  {/* Buttons */}
                  <div className="space-y-3 pt-2 flex flex-col items-center">
                    <motion.button
                      onClick={handleConnect}
                      disabled={isProcessing}
                      whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                      whileTap={{ scale: isProcessing ? 1 : 0.98 }}
                      className="relative w-[450px] bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl border-2 border-white/70 transition-all duration-200 shadow-[0_8px_20px_rgba(255,107,50,0.35)] overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none rounded-xl"></div>
                      <span className="relative z-10">{isProcessing ? 'Processing...' : 'Connect Wallet'}</span>
                    </motion.button>

                    <motion.button
                      onClick={handleClose}
                      disabled={isProcessing}
                      whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                      whileTap={{ scale: isProcessing ? 1 : 0.98 }}
                      className="relative w-[450px] bg-gray-500/90 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl border-2 border-gray-400 transition-all duration-200 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none rounded-xl"></div>
                      <span className="relative z-10">Later</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

