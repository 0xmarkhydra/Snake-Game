import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../services/AuthService';
import { walletService } from '../services/WalletService';

interface WalletInfoProps {
  onLogout: () => void;
}

export const WalletInfo = ({ onLogout }: WalletInfoProps) => {
  const [credit, setCredit] = useState<string>('0.00');
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    // Get wallet address
    const address = authService.getWalletAddress();
    if (address) {
      setWalletAddress(authService.formatWalletAddress(address));
    }

    // Initial credit fetch
    setCredit(walletService.formatCredit());

    // Update credit periodically
    const interval = setInterval(() => {
      setCredit(walletService.formatCredit());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    walletService.stopPolling();
    await authService.logout();
    walletService.clearCredit();
    onLogout();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5, ease: 'backOut' }}
      className="fixed top-5 right-5 z-50"
    >
      <div className="bg-gradient-to-b from-[#0d2828]/95 to-[#081818]/95 backdrop-blur-sm rounded-lg border-2 border-game-blue/80 p-4 min-w-[280px]">
        {/* Wallet Address */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-bold text-white">🔗</span>
          <span className="text-sm font-bold text-white">{walletAddress}</span>
        </div>

        {/* Credit Display */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-400">💎 Credit:</span>
          <span className="text-lg font-bold text-game-gold">{credit}</span>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="text-sm font-bold text-red-400 hover:text-red-500 hover:scale-110 transition-all duration-200 flex items-center gap-2"
        >
          🚪 Logout
        </button>
      </div>
    </motion.div>
  );
};

