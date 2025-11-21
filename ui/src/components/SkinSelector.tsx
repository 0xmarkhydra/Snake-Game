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
      <div className="text-center mb-2 sm:mb-3">
        <h3 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-[linear-gradient(180deg,#bfe6ff_0%,#4a9be4_55%,#0d5c9d_90%)] mb-1">
          CHOOSE YOUR SKIN
        </h3>
        <div className="h-0.5 w-32 sm:w-40 mx-auto bg-gradient-to-r from-[#bfe6ff] via-[#4a9be4] to-[#0d5c9d]"></div>
      </div>

      {/* Skin Grid */}
      <div className="grid grid-cols-4 gap-x-1.5 gap-y-1 sm:gap-x-2 sm:gap-y-1.5 max-w-[310px] mx-auto mt-2 sm:mt-3">
        {SKINS.map((skin) => {
          const isSelected = skin.id === selectedSkin;
          const isHovered = skin.id === hoveredSkin;

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
              {/* Skin Container */}
              <button
                onClick={() => onSelectSkin(skin.id)}
                className="relative w-[55px] h-[55px] sm:w-[60px] sm:h-[60px] rounded-full flex items-center justify-center transition-all duration-200"
              >
                <div
                  className={`w-[45px] h-[45px] sm:w-[50px] sm:h-[50px] rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,0.1)] flex items-center justify-center transition-colors duration-200 border ${
                    isSelected ? 'border-[#f4f6fb]' : 'border-white/60'
                  }`}
                  style={{
                    background: isSelected ? skin.hover : 'rgb(247, 247, 247)',
                  }}
                >
                  <img
                    src={`/images/${skin.image}`}
                    alt={`Snake skin ${skin.id}`}
                    className="w-[38px] h-[38px] sm:w-[42px] sm:h-[42px] object-contain pointer-events-none select-none"
                    draggable="false"
                  />
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

