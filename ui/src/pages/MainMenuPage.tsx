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
import { ENV } from '../configs/env';
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
          setVipInfoText('Need ≥1 credit – click to deposit');
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
        className="absolute inset-0 flex items-center justify-center overflow-hidden p-2 sm:p-4"
      >
        <div className="relative w-full max-w-2xl mx-auto px-3 sm:px-4">
          {/* Menu Panel */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-[140px] border-2 sm:border-4 border-game-blue/40 p-4 sm:p-6 md:p-8 shadow-2xl mt-[120px]"
            style={{ width: 'min(550px, 100%)', height: '706px' }}
          >
            {/* Player Name Input */}
            <div className="mb-4 sm:mb-6 md:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-[linear-gradient(180deg,#bfe6ff_0%,#4a9be4_55%,#0d5c9d_90%)] text-center mb-2">
                YOUR NAME
              </h3>
              <div className="h-0.5 w-32 sm:w-40 mx-auto bg-game-blue mb-3 sm:mb-4"></div>
              <input
                type="text"
                maxLength={15}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full max-w-[260px] mx-auto block px-3 sm:px-4 py-2 sm:py-3 text-center rounded-[32px] border-2 border-white/40 bg-[#eaf0f9] text-game-dark/60 placeholder:text-game-dark/45 text-base sm:text-lg outline-none focus:border-white focus:ring-2 focus:ring-white/50 transition-all"
              />
            </div>

            {/* Skin Selector */}
            <div className="mb-2 sm:mb-3 md:mb-4 flex-shrink-0">
              <SkinSelector
                selectedSkin={selectedSkin}
                onSelectSkin={setSelectedSkin}
              />
            </div>

            {/* Play Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center mb-2 sm:mb-3 md:mb-4 flex-shrink-0">
              {/* Free Button */}
              <motion.button
                onClick={handlePlayFree}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-green-400/50 rounded-[48px] sm:rounded-[64px] blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <div
                  className="relative text-white font-bold text-lg sm:text-xl md:text-2xl py-3 px-8 sm:py-4 sm:px-10 md:px-12 rounded-[48px] sm:rounded-[64px] border-3 border-white/80 shadow-lg transition-all duration-200 group-hover:brightness-110"
                  style={{
                    background: 'linear-gradient(0deg, #c7ffd6 0%, #57e66f 55%, #1c9f3e 100%)',
                  }}
                >
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
                <div className="absolute inset-0 bg-orange-400/50 rounded-[48px] sm:rounded-[64px] blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <div
                  className="relative disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg sm:text-xl md:text-2xl py-3 px-8 sm:py-4 sm:px-10 md:px-12 rounded-[48px] sm:rounded-[64px] border-3 border-white/80 shadow-lg transition-all duration-200 group-hover:brightness-110"
                  style={{
                    background: 'linear-gradient(0deg, #ffe0c7 0%, #ff9a55 55%, #e34d1d 100%)',
                  }}
                >
                  {vipProcessing ? 'LOADING...' : 'PLAY VIP'}
                </div>
              </motion.button>
            </div>

            {/* VIP Info Text */}
            <p 
              className={`text-center text-[10px] sm:text-xs md:text-sm flex-shrink-0 mb-2 ${
                vipInfoText.includes('Ready') 
                  ? 'text-[#9ad6ff]' 
                  : vipInfoText.includes('🔒') 
                  ? 'text-red-400' 
                  : 'text-yellow-400'
              }`}
            >
              {vipInfoText}
            </p>

            {/* Question Task Link */}
            <div className="mt-2 sm:mt-3 md:mt-4 pt-2 sm:pt-3 md:pt-4 border-t border-game-blue/30 flex-shrink-0">
              <motion.a
                href={ENV.QUESTION_TASK_URL}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-[32px] border font-semibold text-xs sm:text-sm transition-all"
                style={{
                  width: '400px',
                  height: '46px',
                  margin: '0 auto',
                  backgroundColor: '#f3f1ef',
                  borderColor: '#d9d4cf',
                  color: '#858180',
                }}
              >
                <span className="text-sm sm:text-lg">📋</span>
                <span>View Tasks & Questions</span>
                <span className="text-[10px] sm:text-xs opacity-70 group-hover:opacity-100">↗</span>
              </motion.a>
            </div>
          </motion.div>

          {/* Instructions */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-white mt-2 sm:mt-3 md:mt-4 text-[10px] sm:text-xs md:text-sm lg:text-base max-w-lg mx-auto px-2 flex-shrink-0"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
          >
            Use mouse to control direction. Click to boost. Eat food to grow. Avoid other snakes!
          </motion.p>

          {/* Version */}
          <p className="text-center text-gray-400 text-[10px] sm:text-xs mt-1 sm:mt-2 flex-shrink-0">
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

