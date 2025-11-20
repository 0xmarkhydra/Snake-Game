import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../services/AuthService';
import { walletService } from '../services/WalletService';
import { vipRoomService } from '../services/VipRoomService';
import { referralService } from '../services/ReferralService';
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
  const [menuReferralCode, setMenuReferralCode] = useState('');

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
    } else {
      // Load referral code from URL if not authenticated
      const refCode = referralService.getReferralCodeFromUrl();
      if (refCode) {
        setMenuReferralCode(refCode.toUpperCase());
      }
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
        setVipInfoText('Login to play VIP');
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
        backgroundImage: 'url(/images/background.webp)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center top',
        backgroundSize: 'cover',
      }}
      >
      {/* SlitherX Title */}
      <h1
        className="absolute left-1/2 transform -translate-x-1/2 z-10 text-4xl sm:text-5xl md:text-6xl font-borel font-bold text-center whitespace-nowrap"
        style={{
          top: '-30px',
          lineHeight: '2',
          padding: '1em 0.5em',
          margin: '0',
          transform: 'translate(-50%, 0)',
        }}
      >
        <span style={{ color: '#0082FF' }}>Slit</span>
        <span
          style={{
            background: 'linear-gradient(90deg, #0082FF 0%, #72BEFF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          herX
        </span>
      </h1>

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
            className="bg-white rounded-[140px] border-2 sm:border-4 border-game-blue/40 pt-[13px] pb-4 px-4 sm:pt-[21px] sm:pb-6 sm:px-6 md:pt-[29px] md:pb-8 md:px-8 shadow-2xl mt-[120px]"
            style={{ 
              width: 'min(420px, 100%)', 
              height: isAuthenticated ? '480px' : '556px', 
              marginLeft: '110px', 
              marginTop: '100px' 
            }}
          >
            {/* Player Name Input */}
            <div className="mb-2 sm:mb-3">
              <h3 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-[linear-gradient(180deg,#bfe6ff_0%,#4a9be4_55%,#0d5c9d_90%)] text-center mb-1">
                YOUR NAME
              </h3>
              <div className="h-0.5 w-24 sm:w-32 mx-auto bg-game-blue mb-2"></div>
              <input
                type="text"
                maxLength={15}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full max-w-[310px] mx-auto block px-2.5 sm:px-3 py-1.5 sm:py-2 text-center rounded-[32px] border-2 border-white/40 bg-[#eaf0f9] text-game-dark/60 placeholder:text-game-dark/45 text-sm sm:text-base outline-none focus:border-white focus:ring-2 focus:ring-white/50 transition-all"
              />
            </div>

            {/* Referral Code Input - Only show when not authenticated */}
            {!isAuthenticated && (
              <div className="mb-3 sm:mb-4 md:mb-5">
                <h3 className="text-sm sm:text-base font-semibold text-transparent bg-clip-text bg-[linear-gradient(180deg,#bfe6ff_0%,#4a9be4_55%,#0d5c9d_90%)] text-center mb-1.5">
                  REFERRAL CODE
                  <span className="text-xs font-normal text-game-dark/50 ml-1">(optional)</span>
                </h3>
                <div className="h-0.5 w-24 sm:w-32 mx-auto bg-game-blue/60 mb-2 sm:mb-3"></div>
                <input
                  type="text"
                  maxLength={16}
                  value={menuReferralCode}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9A-Z]/gi, '').slice(0, 16).toUpperCase();
                    setMenuReferralCode(sanitized);
                  }}
                  placeholder="Enter referral code"
                  className="w-full max-w-[310px] mx-auto block px-3 sm:px-4 py-2 sm:py-2.5 text-center rounded-[32px] border-2 border-white/40 bg-[#eaf0f9] text-game-dark/60 placeholder:text-game-dark/45 text-sm sm:text-base outline-none focus:border-white focus:ring-2 focus:ring-white/50 transition-all tracking-wider"
                />
              </div>
            )}

            {/* Skin Selector */}
            <div className="mb-2 sm:mb-3 md:mb-4 flex-shrink-0">
              <SkinSelector
                selectedSkin={selectedSkin}
                onSelectSkin={setSelectedSkin}
              />
            </div>

            {/* Play Buttons */}
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 justify-center mb-1.5 sm:mb-2 flex-shrink-0">
              {/* Free Button */}
              <motion.button
                onClick={handlePlayFree}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-green-400/50 rounded-[24px] sm:rounded-[32px] blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <div
                  className="relative text-white font-bold text-sm sm:text-base rounded-[24px] sm:rounded-[32px] border-2 border-white/80 group-hover:border-green-400 shadow-lg transition-all duration-200 group-hover:brightness-110 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(0deg, #c7ffd6 0%, #57e66f 55%, #1c9f3e 100%)',
                    width: '150px',
                    height: '45px',
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
                <div className="absolute inset-0 bg-orange-400/50 rounded-[24px] sm:rounded-[32px] blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                <div
                  className="relative disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base rounded-[24px] sm:rounded-[32px] border-2 border-white/80 group-hover:border-orange-400 shadow-lg transition-all duration-200 group-hover:brightness-110 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(0deg, #ffe0c7 0%, #ff9a55 55%, #e34d1d 100%)',
                    width: '150px',
                    height: '45px',
                  }}
                >
                  {vipProcessing ? 'LOADING...' : 'PLAY VIP'}
                </div>
              </motion.button>
            </div>

            {/* VIP Info Text */}
            <p 
              className={`text-center text-[10px] sm:text-xs md:text-sm flex-shrink-0 mb-1 ${
                vipInfoText.includes('Ready') 
                  ? 'text-[#9ad6ff]' 
                  : vipInfoText.includes('🔒') 
                  ? 'text-gray-400' 
                  : 'text-yellow-400'
              }`}
            >
              {vipInfoText}
            </p>

            {/* Question Task Link */}
            <div className="mt-1 flex-shrink-0">
              <motion.a
                href={ENV.QUESTION_TASK_URL}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center gap-1 sm:gap-1.5 rounded-[32px] border font-semibold text-[10px] sm:text-xs transition-all"
                style={{
                  width: '200px',
                  height: '40px',
                  margin: '0 auto',
                  backgroundColor: '#f3f1ef',
                  borderColor: '#d9d4cf',
                  color: '#858180',
                }}
              >
                <span className="text-xs sm:text-sm"></span>
                <span>View Tasks & Questions</span>
                <span className="text-[8px] sm:text-[10px] opacity-70 group-hover:opacity-100">↗</span>
              </motion.a>
            </div>
          </motion.div>

          {/* Version */}
          <p className="text-center text-gray-400 text-[10px] sm:text-xs mt-1 sm:mt-2 flex-shrink-0 ">
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
        initialReferralCode={menuReferralCode || undefined}
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

