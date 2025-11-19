import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../services/AuthService';
import { walletService } from '../services/WalletService';
import { vipRoomService } from '../services/VipRoomService';
import { WalletInfo } from '../components/WalletInfo';
import { SkinSelector } from '../components/SkinSelector';
import { LoginModal } from '../components/LoginModal';
import { DepositModal } from '../components/DepositModal';
import { ReferralStatsModal } from '../components/ReferralStatsModal';
import { GAME_INFO } from '../configs/game';
import type { RoomType, VipAccessCheckResult, VipRoomConfig } from '../types/Game.types';

interface MainMenuPageProps {
  onStartGame: (data: GameStartData) => void;
}

export interface GameStartData {
  playerName: string;
  skinId: number;
  roomType: RoomType;
  vipTicketId?: string;
  vipTicketCode?: string;
  vipConfig?: VipRoomConfig;
  vipCredit?: number;
}

export const MainMenuPage = ({ onStartGame }: MainMenuPageProps) => {
  const [playerName, setPlayerName] = useState('Player');
  const [selectedSkin, setSelectedSkin] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [depositMessage, setDepositMessage] = useState<string | undefined>();
  const [vipProcessing, setVipProcessing] = useState(false);
  const [vipInfoText, setVipInfoText] = useState('');

  useEffect(() => {
    // Check authentication
    const authenticated = authService.isAuthenticated();
    setIsAuthenticated(authenticated);

    // Load user profile if authenticated
    if (authenticated) {
      const profile = authService.getUserProfile();
      if (profile && profile.displayName) {
        setPlayerName(profile.displayName);
      }
      
      // Start polling credit
      walletService.startPolling(3000);
    }

    // Update VIP info text
    const updateVipInfo = () => {
      if (authService.isAuthenticated()) {
        const hasCredit = walletService.hasEnoughCredit(1);
        if (hasCredit) {
          setVipInfoText('Ready to play VIP!');
        } else {
          setVipInfoText('Cần ≥1 credit – nhấn để nạp');
        }
      } else {
        setVipInfoText('🔒 Login to play VIP');
      }
    };

    updateVipInfo();
    const interval = setInterval(updateVipInfo, 1000);

    return () => {
      clearInterval(interval);
      walletService.stopPolling();
    };
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPlayerName('Player');
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    const profile = authService.getUserProfile();
    if (profile && profile.displayName) {
      setPlayerName(profile.displayName);
    }
  };

  const handleShowDeposit = (message?: string) => {
    setDepositMessage(message);
    setShowDepositModal(true);
  };

  const handleDepositSuccess = () => {
    // Refresh credit info
    walletService.getCredit();
  };

  const handlePlayFree = () => {
    onStartGame({
      playerName,
      skinId: selectedSkin,
      roomType: 'free',
    });
  };

  const handlePlayVip = async () => {
    if (vipProcessing) return;

    // Check authentication
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    try {
      setVipProcessing(true);
      const credit = await walletService.getCredit();
      
      if (credit >= 1) {
        // Get VIP access
        const vipAccess: VipAccessCheckResult = await vipRoomService.checkAccess();

        if (!vipAccess.canJoin || !vipAccess.ticket?.id) {
          const message = vipAccess.reason ?? 'You do not have enough credit to join the VIP room.';
          alert(message);
          return;
        }

        // Start VIP game
        onStartGame({
          playerName,
          skinId: selectedSkin,
          roomType: 'vip',
          vipTicketId: vipAccess.ticket.id,
          vipTicketCode: vipAccess.ticket.ticketCode,
          vipConfig: vipAccess.config,
          vipCredit: vipAccess.credit,
        });
      } else {
        handleShowDeposit('Credit is still below the requirement. Please deposit to join VIP rooms.');
      }
    } catch (error) {
      console.error('❌ Failed to prepare VIP access:', error);
      alert('Unable to verify VIP access. Please try again.');
    } finally {
      setVipProcessing(false);
    }
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#f2f6ff]"
      style={{
        backgroundImage: 'url(/images/background.png)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center top',
        backgroundSize: 'cover',
      }}
    >

      {/* Wallet Controls */}
      {isAuthenticated && (
        <WalletInfo onLogout={handleLogout} />
      )}

      {/* Main Content Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: 'backOut' }}
        className="absolute inset-0 flex items-center justify-center overflow-y-auto py-4 sm:py-0"
      >
        <div className="relative w-full max-w-2xl mx-auto px-3 sm:px-4" style={{ marginTop: '80px' }}>
          {/* Menu Panel */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white/95 backdrop-blur-xl rounded-[48px] sm:rounded-[96px] border-2 border-white/70 shadow-[0_25px_60px_rgba(13,27,62,0.25)] p-5 sm:p-7 md:p-9 w-full max-w-[511px] min-h-[643px] mx-auto flex flex-col"
          >
            {/* Player Name Input */}
            <div className="mb-4 sm:mb-6 md:mb-8 text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-[linear-gradient(180deg,#bfe6ff_0%,#4a9be4_55%,#0d5c9d_90%)] mb-2">
                YOUR NAME
              </h3>
              <div className="h-0.5 w-32 sm:w-40 mx-auto bg-gradient-to-r from-[#39FF14] via-[#38bdf8] to-[#39FF14] mb-3 sm:mb-4"></div>
              <input
                type="text"
                maxLength={15}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full max-w-[280px] mx-auto block px-4 py-2.5 sm:py-3 text-center rounded-[36px] border border-[#cfd9ef] bg-[#f4f6fb]/90 text-[#0f1f4b] text-base sm:text-lg font-semibold placeholder:text-[#8da0d1] shadow-[0_8px_22px_rgba(13,27,62,0.1)] focus:border-[#39FF14]/70 focus:ring-4 focus:ring-[#39FF14]/20 transition-all backdrop-blur-sm"
              />
            </div>

            {/* Skin Selector */}
            <div className="mb-4 sm:mb-6 md:mb-8">
              <SkinSelector
                selectedSkin={selectedSkin}
                onSelectSkin={setSelectedSkin}
              />
            </div>

            {/* Play Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 justify-center mb-4 sm:mb-6">
              {/* Free Button */}
              <motion.button
                onClick={handlePlayFree}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-green-300/15 rounded-[36px] sm:rounded-[72px] blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-gradient-to-t from-[#bdfec6] via-[#65ff81] to-[#26d13f] text-[#11631f] font-bold text-lg sm:text-xl md:text-2xl w-[200px] h-[50px] sm:h-[54px] md:h-[58px] flex items-center justify-center rounded-[36px] sm:rounded-[72px] border border-white/60 shadow-[0_10px_24px_rgba(17,99,31,0.25)]">
                  PLAY FREE
                </div>
              </motion.button>

              {/* VIP Button */}
              <motion.button
                onClick={handlePlayVip}
                disabled={vipProcessing}
                whileHover={{ scale: vipProcessing ? 1 : 1.05 }}
                whileTap={{ scale: vipProcessing ? 1 : 0.95 }}
                className="relative group w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-orange-400/20 rounded-[36px] sm:rounded-[72px] blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-gradient-to-t from-[#ffc79d] via-[#ff945f] to-[#f34f13] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg sm:text-xl md:text-2xl w-[200px] h-[50px] sm:h-[54px] md:h-[58px] flex items-center justify-center rounded-[36px] sm:rounded-[72px] border border-white/60 shadow-[0_12px_26px_rgba(204,92,37,0.35)]">
                  {vipProcessing ? 'LOADING...' : 'PLAY VIP'}
                </div>
              </motion.button>
            </div>

            {/* VIP Info Text */}
            <p 
              className={`text-center text-xs sm:text-sm ${
                vipInfoText.includes('Ready') 
                  ? 'text-[#9ad6ff]' 
                  : vipInfoText.includes('🔒') 
                  ? 'text-red-400' 
                  : 'text-yellow-400'
              }`}
            >
              {vipInfoText}
            </p>
          </motion.div>

          {/* Instructions */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-white mt-4 sm:mt-6 text-sm sm:text-base max-w-lg mx-auto px-2"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
          >
            Use mouse to control direction. Click to boost. Eat food to grow. Avoid other snakes!
          </motion.p>

          {/* Version */}
          <p className="text-center text-gray-400 text-xs mt-2 mb-4 sm:mb-0">
            v{GAME_INFO.version}
          </p>
        </div>
      </motion.div>

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        onShowDeposit={handleShowDeposit}
      />

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => {
          setShowDepositModal(false);
          setDepositMessage(undefined);
        }}
        onDepositSuccess={handleDepositSuccess}
        initialMessage={depositMessage}
      />

      <ReferralStatsModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
      />
    </div>
  );
};

