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
    <div className="relative w-full h-full overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-game-dark to-game-blue" />

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />

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
        <div className="relative w-full max-w-2xl mx-auto px-3 sm:px-4 max-h-full flex flex-col items-center justify-center">
          {/* Title */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-center mb-2 sm:mb-4 md:mb-6 flex-shrink-0"
          >
            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-1 sm:mb-2 md:mb-4 drop-shadow-lg"
              style={{
                background: 'linear-gradient(to top, #c28a0a 0%, #ffe7b3 40%, #fff8e1 60%, #ffffff 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {GAME_INFO.name}
            </h1>
            <p
              className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold stroke-black"
              style={{
                background: 'linear-gradient(to top, #c28a0a 0%, #ffe7b3 40%, #fff8e1 60%, #ffffff 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Multiplayer Snake Game
            </p>
          </motion.div>

          {/* Menu Panel */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-game-dark/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border-2 sm:border-4 border-game-blue/80 p-3 sm:p-4 md:p-6 lg:p-8 shadow-2xl w-full flex-shrink min-h-0 overflow-hidden flex flex-col"
          >
            {/* Player Name Input */}
            <div className="mb-2 sm:mb-3 md:mb-4 flex-shrink-0">
              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-[#39FF14] text-center mb-1 sm:mb-2">YOUR NAME</h3>
              <div className="h-0.5 w-24 sm:w-32 md:w-40 mx-auto bg-game-blue mb-2 sm:mb-3"></div>
              <input
                type="text"
                maxLength={15}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full max-w-[260px] mx-auto block px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-center rounded-lg border-2 border-game-blue bg-game-dark/70 text-white text-sm sm:text-base md:text-lg outline-none focus:border-game-light focus:ring-2 focus:ring-game-blue transition-all"
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
                <div className="absolute inset-0 bg-green-400/50 rounded-xl sm:rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-base sm:text-lg md:text-xl lg:text-2xl py-2 sm:py-2.5 md:py-3 px-6 sm:px-8 md:px-10 lg:px-12 rounded-xl sm:rounded-2xl border-3 border-white/80 shadow-lg">
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
                <div className="absolute inset-0 bg-orange-400/50 rounded-xl sm:rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base sm:text-lg md:text-xl lg:text-2xl py-2 sm:py-2.5 md:py-3 px-6 sm:px-8 md:px-10 lg:px-12 rounded-xl sm:rounded-2xl border-3 border-white/80 shadow-lg">
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
                className="flex items-center justify-center gap-1.5 sm:gap-2 w-full py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/50 hover:border-purple-400 text-purple-300 hover:text-purple-200 font-semibold text-xs sm:text-sm transition-all group"
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

