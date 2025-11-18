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
          <div className="relative bg-gradient-to-br from-[#0a1f2e]/95 via-[#0d2838]/95 to-[#081d28]/95 backdrop-blur-md rounded-xl border-2 border-game-blue/60 shadow-xl shadow-game-blue/20 px-3 py-2 flex items-center gap-2">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-game-blue/10 via-transparent to-game-gold/5 animate-pulse pointer-events-none rounded-xl" />
            
            <span className="relative text-xl animate-pulse">💎</span>
            <motion.span
              key={credit}
              initial={{ scale: 1.1, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-game-gold via-yellow-300 to-game-gold"
            >
              {credit}
            </motion.span>
            <span className="relative text-xs text-gray-400">▼</span>
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
          <div className="relative bg-gradient-to-br from-[#0a1f2e]/95 via-[#0d2838]/95 to-[#081d28]/95 backdrop-blur-md rounded-xl border-2 border-game-blue/60 shadow-2xl shadow-game-blue/20 p-3 min-w-[280px] overflow-hidden">
            {/* Animated Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-game-blue/10 via-transparent to-game-gold/5 animate-pulse pointer-events-none" />
            
            {/* Mobile Close Button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="sm:hidden absolute top-1 right-1 z-20 text-gray-400 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>

            {/* Content Wrapper */}
            <div className="relative z-10">
              {/* Wallet Address (Compact) */}
              <motion.button
                onClick={handleCopyAddress}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-1.5 w-full p-1.5 mb-2 rounded-lg bg-game-blue/10 hover:bg-game-blue/20 border border-game-blue/30 transition-all group"
              >
                <span className="text-sm">🔗</span>
                <span className="text-xs font-bold text-white flex-1 text-left truncate">{walletAddress}</span>
                {copied && <span className="text-[10px] text-green-400">✓</span>}
              </motion.button>

              {/* Credit Display Section (Compact) */}
              <div className="mb-2 pb-2 border-b border-game-gold/30">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="text-lg animate-pulse">💎</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Credit Balance</span>
                  </div>
                  <motion.div
                    key={credit}
                    initial={{ scale: 1.1, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-game-gold via-yellow-300 to-game-gold"
                  >
                    {credit}
                  </motion.div>
                  <div className="text-[10px] text-gray-500">USDC</div>
                </div>
              </div>

              {/* Referral Code Section */}
              <div className="mb-2 pb-2 border-b border-cyan-400/30">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="text-sm">🎁</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Referral Code</span>
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
                        className="flex items-center justify-center gap-2 w-full p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 transition-all group"
                      >
                        <span className="text-lg font-bold text-cyan-300">{referralCode}</span>
                        {referralCopied ? (
                          <span className="text-[10px] text-green-400">✓</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 group-hover:text-cyan-300">📋</span>
                        )}
                      </motion.button>
                      <motion.button
                        onClick={() => setIsReferralModalOpen(true)}
                        whileTap={{ scale: 0.98 }}
                        className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        View Stats →
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      onClick={() => setIsReferralModalOpen(true)}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 font-semibold text-xs transition-all"
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
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/50 hover:border-green-400 text-green-400 hover:text-green-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 group"
                >
                  <span className="text-sm">💰</span>
                  <span>Deposit</span>
                </motion.button>

                {/* Withdraw Button */}
                <motion.button
                  onClick={() => setIsWithdrawModalOpen(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-orange-500/20 to-yellow-500/20 hover:from-orange-500/30 hover:to-yellow-500/30 border border-orange-500/50 hover:border-orange-400 text-orange-400 hover:text-orange-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 group"
                >
                  <span className="text-sm">💸</span>
                  <span>Withdraw</span>
                </motion.button>

                {/* Logout Button */}
                <motion.button
                  onClick={handleLogout}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 border border-red-500/50 hover:border-red-400 text-red-400 hover:text-red-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 group"
                >
                  <span className="text-sm">🚪</span>
                  <span>Disconnect Wallet</span>
                </motion.button>
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
      />

      {/* Referral Stats Modal */}
      <ReferralStatsModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />
    </>
  );
};

