import { motion } from 'framer-motion';

interface ConnectPromptProps {
  onConnect: () => void;
}

export const ConnectPrompt = ({ onConnect }: ConnectPromptProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5, ease: 'backOut' }}
      className="fixed top-5 right-5 z-50"
    >
      <div className="bg-gradient-to-b from-[#0d1828]/95 to-[#081020]/95 backdrop-blur-sm rounded-lg border-2 border-game-blue/80 p-4 w-[260px]">
        {/* Title */}
        <h3 className="text-sm font-bold text-white mb-2">
          Connect Wallet
        </h3>

        {/* Description */}
        <p className="text-xs text-[#9ad6ff] mb-4 leading-relaxed">
          Login to unlock VIP rooms and deposit credit directly in the game.
        </p>

        {/* Connect Button */}
        <motion.button
          onClick={onConnect}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-bold py-3 px-4 rounded-lg border-2 border-white/90 transition-all duration-200"
        >
          Connect Wallet
        </motion.button>
      </div>
    </motion.div>
  );
};

