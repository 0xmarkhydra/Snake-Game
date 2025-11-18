import { motion } from 'framer-motion';

export const MobileBlock = () => {
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
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

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'backOut' }}
        className="relative z-10 max-w-md mx-auto px-6 text-center"
      >
        {/* Icon */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-6"
        >
          <svg
            className="w-24 h-24 mx-auto text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </motion.div>

        {/* Message Card */}
        <div className="bg-game-dark/90 backdrop-blur-sm rounded-2xl border-4 border-red-500/80 p-8 shadow-2xl">
          <h1
            className="text-2xl sm:text-3xl font-bold mb-4 drop-shadow-lg"
            style={{
              background: 'linear-gradient(to top, #ef4444 0%, #fca5a5 40%, #fecaca 60%, #ffffff 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Device Not Supported
          </h1>

          <div className="h-1 w-32 mx-auto bg-red-500 mb-6"></div>

          <p className="text-white text-base sm:text-lg mb-6 leading-relaxed">
            This game only supports desktop devices.
            <br />
            Please use a computer to play the game.
          </p>

          <div className="bg-game-dark/70 rounded-lg p-4 border-2 border-game-blue/50">
            <p className="text-yellow-400 text-sm font-semibold mb-2">
              💻 Device Requirements:
            </p>
            <ul className="text-gray-300 text-sm text-left space-y-1">
              <li>• Desktop Computer</li>
              <li>• Laptop</li>
              <li>• Screen larger than 768px</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

