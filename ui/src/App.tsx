import { useMemo, useRef, useState, useEffect } from 'react';
import DepositTestPage from './pages/DepositTestPage';
import { MainMenuPage, GameStartData } from './pages/MainMenuPage';
import { IRefPhaserGame, PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import { authService } from './services/AuthService';
import './App.css';

type GameState = 'loading' | 'menu' | 'playing';

function App() {
  const isDepositTest = useMemo(
    () => window.location.pathname.replace(/\/$/, '') === '/deposit-test',
    [],
  );

  const [gameState, setGameState] = useState<GameState>('loading');
  const phaserRef = useRef<IRefPhaserGame | null>(null);
  const gameStartDataRef = useRef<GameStartData | null>(null);

  useEffect(() => {
    // Listen for LoadingScene completion
    const handleSceneReady = (scene: Phaser.Scene) => {
      console.log('Current scene:', scene.scene.key);
      
      if (scene.scene.key === 'LoadingScene') {
        // LoadingScene finished, transition to menu
        setTimeout(() => {
          setGameState('menu');
        }, 400);
      }
    };

    EventBus.on('current-scene-ready', handleSceneReady);

    return () => {
      EventBus.off('current-scene-ready', handleSceneReady);
    };
  }, []);

  useEffect(() => {
    // When transitioning to playing state, start GameScene
    if (gameState === 'playing' && phaserRef.current?.game && gameStartDataRef.current) {
      const game = phaserRef.current.game;
      const data = gameStartDataRef.current;

      // Stop current scene and start GameScene
      setTimeout(() => {
        game.scene.stop('LoadingScene');
        game.scene.stop('MenuScene');
        game.scene.start('GameScene', {
          ...data,
          isAuthenticated: authService.isAuthenticated(),
        });
      }, 100);
    }
  }, [gameState]);

  if (isDepositTest) {
    return (
      <div id="deposit-test" className="deposit-test-wrapper">
        <DepositTestPage />
      </div>
    );
  }

  const handleStartGame = (data: GameStartData) => {
    console.log('Starting game with data:', data);
    gameStartDataRef.current = data;
    setGameState('playing');
  };

  // TODO: Use this when implementing back to menu from game
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBackToMenu = () => {
    gameStartDataRef.current = null;
    setGameState('menu');
  };

  return (
    <div id="app" className="fullscreen">
      {/* Phaser Game Canvas - visible during loading and playing */}
      <PhaserGame 
        ref={phaserRef} 
        visible={gameState === 'loading' || gameState === 'playing'}
      />

      {/* React Menu - visible when state is menu */}
      {gameState === 'menu' && (
        <MainMenuPage onStartGame={handleStartGame} />
      )}
    </div>
  );
}

export default App;
