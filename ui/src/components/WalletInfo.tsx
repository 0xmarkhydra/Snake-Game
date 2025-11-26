import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/AuthService';
import { walletService } from '../services/WalletService';
import { referralService } from '../services/ReferralService';
import { WithdrawModal } from './WithdrawModal';
import { DepositModal } from './DepositModal';
import { ReferralStatsModal } from './ReferralStatsModal';

interface WalletInfoProps {
  onLogout: () => void;
}

export const WalletInfo = ({ onLogout }: WalletInfoProps) => {
  const [credit, setCredit] = useState<string>('0.00');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralCopied, setReferralCopied] = useState(false);
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [showWithdrawAmountEffect, setShowWithdrawAmountEffect] = useState(false);
  const [withdrawAmountEffectValue, setWithdrawAmountEffectValue] = useState<string>('');

  useEffect(() => {
    // Get wallet address
    const address = authService.getWalletAddress();
    if (address) {
      setWalletAddress(authService.formatWalletAddress(address));
    }

    // Initial credit fetch
    setCredit(walletService.formatCredit());

    // Load referral code
    const loadReferralCode = async () => {
      if (!authService.isAuthenticated()) return;
      
      setIsLoadingReferral(true);
      try {
        const data = await referralService.getMyReferralCode();
        if (data && data.referralCode) {
          setReferralCode(data.referralCode);
        }
      } catch (error) {
        console.error('Failed to load referral code:', error);
        // Keep referral code empty - section will show button to open modal instead
      } finally {
        setIsLoadingReferral(false);
      }
    };
    
    loadReferralCode();

    // Update credit periodically (increased from 1s to 3s for better performance)
    const interval = setInterval(() => {
      const newCredit = walletService.formatCredit();
      // Only update if credit actually changed to prevent unnecessary re-renders
      if (newCredit !== credit) {
        setCredit(newCredit);
      }
    }, 3000); // Changed from 1000ms to 3000ms

    return () => clearInterval(interval);
  }, [credit]); // Added credit to dependency array

  const handleCopyAddress = async () => {
    const fullAddress = authService.getWalletAddress();
    if (fullAddress) {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyReferralCode = async () => {
    if (referralCode) {
      await navigator.clipboard.writeText(referralCode);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    walletService.stopPolling();
    await authService.logout();
    walletService.clearCredit();
    onLogout();
  };

  const handleWithdrawSuccess = () => {
    // Refresh credit after successful withdrawal
    const newCredit = walletService.getCachedCredit();
    setCredit(walletService.formatCredit(newCredit));
  };

  const handleDepositSuccess = () => {
    // Refresh credit after successful deposit
    const newCredit = walletService.getCachedCredit();
    setCredit(walletService.formatCredit(newCredit));
  };

  const handleShowWithdrawAmountEffect = (amount: number) => {
    // Làm tròn amount thành số nguyên, không giữ .0 phía sau
    const rounded = Math.round(amount);
    setWithdrawAmountEffectValue(rounded.toString());
    setShowWithdrawAmountEffect(true);
  };

  return (
    <>
      {/* Backdrop for mobile expanded state */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 sm:hidden"
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.5, ease: 'backOut' }}
        className="fixed top-2 right-2 sm:top-5 sm:right-5 z-50"
      >
        {/* Compact View (Mobile Only) */}
        <motion.button
          onClick={() => setIsExpanded(true)}
          whileTap={{ scale: 0.95 }}
          className={`sm:hidden ${isExpanded ? 'hidden' : 'block'}`}
        >
          <div className="relative bg-gray-100 backdrop-blur-md rounded-[40px] border border-gray-300/50 shadow-xl shadow-gray-400/30 px-3 py-2 flex items-center gap-2">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-game-blue/10 via-transparent to-game-gold/5 animate-pulse pointer-events-none rounded-[40px]" />
            
            <span className="relative text-xl animate-pulse">💎</span>
            <motion.span
              key={credit}
              initial={{ scale: 1.1, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative text-xl font-black font-SFPro text-transparent bg-clip-text bg-gradient-to-r from-game-gold via-yellow-300 to-game-gold"
            >
              {credit}
            </motion.span>
            <span className="relative text-xs font-SFPro text-gray-400">▼</span>
          </div>
        </motion.button>

        {/* Full Panel (Desktop Always / Mobile When Expanded) */}
        <motion.div
          initial={false}
          animate={{
            opacity: isExpanded ? 1 : 1,
            scale: isExpanded ? 1 : 1,
          }}
          className={`${isExpanded ? 'block' : 'hidden'} sm:block max-w-[calc(100vw-1rem)] sm:max-w-none`}
        >
          <div className="relative bg-gray-100 backdrop-blur-md rounded-[40px] border border-gray-300/50 shadow-2xl shadow-gray-400/30 p-3 min-w-[280px] overflow-hidden">
            {/* Animated Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-game-blue/10 via-transparent to-game-gold/5 animate-pulse pointer-events-none rounded-[40px]" />
            
            {/* Mobile Close Button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="sm:hidden absolute top-1 right-1 z-20 text-gray-400 hover:text-white transition-colors text-lg font-SFPro"
            >
              ✕
            </button>

            {/* Content Wrapper */}
            <div className="relative z-10">
              {/* Wallet Address (Compact) */}
              <motion.button
                onClick={handleCopyAddress}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-1.5 w-full p-1.5 mb-2 rounded-[40px] bg-white/50 hover:bg-white/70 border border-gray-300 transition-all group"
              >
                <span className="text-sm">🔗</span>
                <span className="text-xs font-bold font-SFPro text-gray-700 flex-1 text-left truncate">{walletAddress}</span>
                {copied && <span className="text-[10px] font-SFPro text-green-500">✓</span>}
              </motion.button>

              {/* Credit Display Section (Compact) */}
              <div className="mb-2 pb-2 border-b border-gray-300">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <img src="/images/dola.png" alt="$" className="w-4 h-4" />
                    <span className="text-[13px] font-SFPro text-gray-600 uppercase"> Credit Balance</span>
                  </div>
                  <motion.div
                    key={credit}
                    initial={{ scale: 1.1, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-3xl font-black font-SFPro text-blue-600"
                  >
                    {credit}
                  </motion.div>
                  <div className="text-[10px] font-SFPro text-gray-500">USDC</div>
                </div>
              </div>

              {/* White Container for Referral Code and Action Buttons */}
              <div className="bg-white rounded-[20px] p-3">
                {/* Referral Code Section */}
                <div className="mb-2 pb-2 border-b border-cyan-400/30">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="text-xs font-semibold font-SFPro text-gray-600 uppercase">Referral Code</span>
                    </div>
                    {isLoadingReferral ? (
                      <div className="flex items-center justify-center py-2">
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : referralCode ? (
                      <>
                        <motion.button
                          onClick={handleCopyReferralCode}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center justify-center gap-2 w-full p-1.5 rounded-[40px] bg-blue-500 hover:bg-blue-600 border border-blue-400 transition-all group font-SFPro"
                        >
                          <span className="text-lg font-bold font-SFPro text-white">{referralCode}</span>
                          {referralCopied ? (
                            <span className="text-[10px] font-SFPro text-green-300">✓</span>
                          ) : (
                            <span className="text-[10px] font-SFPro text-white/70 group-hover:text-white">📋</span>
                          )}
                        </motion.button>
                        <motion.button
                          onClick={() => setIsReferralModalOpen(true)}
                          whileTap={{ scale: 0.98 }}
                          className="mt-1 text-[10px] font-SFPro text-blue-500 hover:text-blue-600 transition-colors"
                        >
                          View Stats →
                        </motion.button>
                      </>
                    ) : (
                      <motion.button
                        onClick={() => setIsReferralModalOpen(true)}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-2 px-3 rounded-[40px] bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 font-semibold font-SFPro text-xs transition-all"
                      >
                        View Referral Program
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Action Buttons (Compact) */}
                <div className="space-y-1.5">
                  {/* Deposit Button */}
                  <motion.button
                    onClick={() => setIsDepositModalOpen(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2 px-3 rounded-[40px] bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 border border-orange-600 text-white font-bold font-SFPro text-xs transition-all flex items-center justify-center group"
                  >
                    <span className="font-SFPro">Deposit</span>
                  </motion.button>

                  {/* Withdraw Button */}
                  <motion.button
                    onClick={() => setIsWithdrawModalOpen(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2 px-3 rounded-[40px] bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border border-green-600 text-white font-bold font-SFPro text-xs transition-all flex items-center justify-center group"
                  >
                    <span className="font-SFPro">Cash Out</span>
                  </motion.button>

                  {/* Logout Button */}
                  <motion.button
                    onClick={handleLogout}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2 px-3 rounded-[40px] bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border border-red-600 text-white font-bold font-SFPro text-xs transition-all flex items-center justify-center group"
                  >
                    <span className="font-SFPro">Disconnect Wallet</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onDepositSuccess={handleDepositSuccess}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        onWithdrawSuccess={handleWithdrawSuccess}
        onShowAmountEffect={handleShowWithdrawAmountEffect}
      />

      {/* Referral Stats Modal */}
      <ReferralStatsModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />

      {/* Global Withdraw Amount Effect (shows after popup is closed) */}
      <AnimatePresence>
        {showWithdrawAmountEffect && withdrawAmountEffectValue && (
          <motion.div
            key="withdraw-amount-effect"
            initial={{ y: 80, scale: 0.7, opacity: 0 }}
            animate={{ y: -40, scale: 1.8, opacity: 1 }}
            exit={{ y: -140, scale: 2, opacity: 0 }}
            transition={{ duration: 2.1, ease: 'easeOut' }}
            className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center"
            onAnimationComplete={() => setShowWithdrawAmountEffect(false)}
          >
            <span className="flex items-center gap-3 sm:gap-4 text-4xl sm:text-5xl font-black text-white font-SFPro drop-shadow-[0_0_16px_rgba(0,0,0,0.95)] [text-shadow:_0_0_0_3px_#1f6fe5]">
              <span>+ {withdrawAmountEffectValue}</span>
              <img src="/images/iconUsdc.png" alt="USDC" className="w-8 h-8 sm:w-10 sm:h-10" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

