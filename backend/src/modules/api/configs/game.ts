export const configGame = () => ({
  game: {
    internalApiKey: process.env.GAME_INTERNAL_API_KEY ?? '',
  },
});
