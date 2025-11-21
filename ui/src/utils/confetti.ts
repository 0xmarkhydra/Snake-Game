// Simple wrapper around dynamic import of canvas-confetti
// to avoid loading it on initial bundle.

let cachedConfetti: any | null = null;

async function getConfetti() {
  if (cachedConfetti) return cachedConfetti;

  const module = await import('canvas-confetti');
  cachedConfetti = module.default || module;
  return cachedConfetti;
}

/**
 * Fire a celebratory confetti burst from the bottom center of the screen.
 */
export async function fireWithdrawConfetti() {
  try {
    const confetti = await getConfetti();

    const baseConfig = {
      startVelocity: 55,
      spread: 110,
      ticks: 220,
      gravity: 0.9,
      scalar: 1.35,
      origin: { x: 0.5, y: 1 },
      angle: 90,
    } as const;

    // Central big burst
    confetti({
      ...baseConfig,
      particleCount: 200,
    });

    // Side bursts for fuller screen feeling
    confetti({
      ...baseConfig,
      particleCount: 120,
      angle: 80,
      origin: { x: 0.2, y: 1 },
    });

    confetti({
      ...baseConfig,
      particleCount: 120,
      angle: 100,
      origin: { x: 0.8, y: 1 },
    });
  } catch (error) {
    console.error('Failed to fire confetti:', error);
  }
}


