import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface SkinSelectorProps {
  selectedSkin: number;
  onSelectSkin: (skinId: number) => void;
}

const SKIN_COLORS = [
  0xFF5733, // Orange
  0x33FF57, // Green
  0x3357FF, // Blue
  0xF3FF33, // Yellow
  0xFF33F3, // Pink
  0x33FFF3, // Cyan
  0x9933FF, // Purple
  0xFF3333  // Red
];

const SKINS = [0, 1, 2, 3, 4, 5, 6, 7];

export const SkinSelector = ({ selectedSkin, onSelectSkin }: SkinSelectorProps) => {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [hoveredSkin, setHoveredSkin] = useState<number | null>(null);

  useEffect(() => {
    // Draw skin preview on each canvas
    SKINS.forEach((skinId, index) => {
      const canvas = canvasRefs.current[index];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, 55, 55);

      // Draw circle for snake head
      ctx.beginPath();
      ctx.arc(27.5, 27.5, 16, 0, Math.PI * 2);
      
      // Convert hex color to RGB
      const color = SKIN_COLORS[skinId];
      const r = (color >> 16) & 0xFF;
      const g = (color >> 8) & 0xFF;
      const b = color & 0xFF;
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

      // Draw eyes
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(33, 21, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(33, 34, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  return (
    <div className="w-full">
      {/* Label */}
      <div className="text-center mb-4">
        <h3 className="text-2xl font-bold text-white mb-2">CHOOSE YOUR SKIN</h3>
        <div className="h-0.5 w-60 mx-auto bg-game-blue"></div>
      </div>

      {/* Skin Grid */}
      <div className="grid grid-cols-4 gap-6 max-w-sm mx-auto mt-8">
        {SKINS.map((skinId, index) => {
          const isSelected = skinId === selectedSkin;
          const isHovered = skinId === hoveredSkin;

          return (
            <motion.div
              key={skinId}
              className="relative flex items-center justify-center"
              animate={{
                scale: isSelected ? 1.2 : isHovered ? 1.1 : 1,
              }}
              transition={{ duration: 0.2, ease: 'backOut' }}
              onHoverStart={() => setHoveredSkin(skinId)}
              onHoverEnd={() => setHoveredSkin(null)}
            >
              {/* Selection Glow */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 -m-2 bg-yellow-400/30 rounded-xl"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}

              {/* Skin Container */}
              <button
                onClick={() => onSelectSkin(skinId)}
                className={`
                  relative w-[55px] h-[55px] rounded-xl
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

