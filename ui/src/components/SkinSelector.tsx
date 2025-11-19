import { useState } from 'react';
import { motion } from 'framer-motion';

interface SkinSelectorProps {
  selectedSkin: number;
  onSelectSkin: (skinId: number) => void;
}

const SKINS = [
  { id: 0, image: 'mashblue.png', hover: '#c5d4ff' },
  { id: 1, image: 'mashcyan.png', hover: '#c6fbff' },
  { id: 2, image: 'mashgreen.png', hover: '#c9ffbe' },
  { id: 3, image: 'mashorange.png', hover: '#ffdcc3' },
  { id: 4, image: 'mashpeach.png', hover: '#ffd0d0' },
  { id: 5, image: 'mashpink.png', hover: '#f5cffd' },
  { id: 6, image: 'mashviolet.png', hover: '#dfd1ff' },
  { id: 7, image: 'mashyellow.png', hover: '#fff4bf' },
];

export const SkinSelector = ({ selectedSkin, onSelectSkin }: SkinSelectorProps) => {
  const [hoveredSkin, setHoveredSkin] = useState<number | null>(null);

  return (
    <div className="w-full">
      {/* Label */}
      <div className="text-center mb-3 sm:mb-4">
        <h3 className="text-xl sm:text-2xl font-bold text-[#39FF14] mb-2">CHOOSE YOUR SKIN</h3>
        <div className="h-0.5 w-48 sm:w-60 mx-auto bg-game-blue"></div>
      </div>

      {/* Skin Grid */}
      <div className="grid grid-cols-4 gap-3 sm:gap-4 md:gap-6 max-w-sm mx-auto mt-4 sm:mt-6 md:mt-8">
        {SKINS.map((skinId, index) => {
          const isSelected = skinId === selectedSkin;
          const isHovered = skinId === hoveredSkin;

          return (
            <motion.div
              key={skin.id}
              className="relative flex items-center justify-center"
              animate={{
                scale: isSelected ? 1.15 : isHovered ? 1.1 : 1,
              }}
              transition={{ duration: 0.2, ease: 'backOut' }}
              onHoverStart={() => setHoveredSkin(skin.id)}
              onHoverEnd={() => setHoveredSkin(null)}
            >
              {/* Selection Glow */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 -m-1 sm:-m-2 bg-yellow-400/30 rounded-lg sm:rounded-xl"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}

              {/* Skin Container */}
              <button
                onClick={() => onSelectSkin(skinId)}
                className={`
                  relative w-[50px] h-[50px] sm:w-[55px] sm:h-[55px] rounded-lg sm:rounded-xl
                  bg-gradient-to-b from-game-dark to-[#0a3473]
                  border-2 transition-all duration-200
                  ${isSelected 
                    ? 'border-yellow-400 ring-2 ring-yellow-400' 
                    : 'border-game-blue/80 hover:border-game-light'
                  }
                `}
              >
                <canvas
                  ref={(el) => (canvasRefs.current[index] = el)}
                  width={55}
                  height={55}
                  className="w-full h-full"
                />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

