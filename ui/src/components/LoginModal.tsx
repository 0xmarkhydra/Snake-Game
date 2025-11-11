import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/AuthService';
import { walletService } from '../services/WalletService';

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

  const handleConnect = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setStatusColor('text-yellow-300');
      setStatusText('Đang mở Phantom...');

      await authService.login();
      setStatusText('Đăng nhập thành công! Đang kiểm tra credit...');

      walletService.startPolling(3000);

      const credit = await walletService.getCredit();
      if (credit >= 1) {
        setStatusColor('text-green-400');
        setStatusText('Đã kết nối Phantom thành công!\nBạn đã sẵn sàng chơi VIP.\nNhấn PLAY VIP khi muốn tham gia.');
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
      console.error('Kết nối Phantom thất bại', error);
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
                Chơi VIP cần Phantom
              </h2>

              {/* Description */}
              <p className="text-sm text-[#9ad6ff] text-center mb-4 leading-relaxed">
                Kết nối Phantom wallet để tham gia phòng VIP và nhận thưởng.
              </p>

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
                  {isProcessing ? 'Đang xử lý...' : 'Kết nối Phantom'}
                </motion.button>

                <motion.button
                  onClick={handleClose}
                  disabled={isProcessing}
                  whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                  whileTap={{ scale: isProcessing ? 1 : 0.98 }}
                  className="w-full bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl border-2 border-gray-500 transition-all duration-200"
                >
                  Để sau
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

