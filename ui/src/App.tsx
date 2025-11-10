import { useMemo, useRef } from 'react';
import DepositTestPage from './pages/DepositTestPage';
import { IRefPhaserGame, PhaserGame } from './game/PhaserGame';
import './App.css';

function App() {
  const isDepositTest = useMemo(
    () => window.location.pathname.replace(/\/$/, '') === '/deposit-test',
    [],
  );

  if (isDepositTest) {
    return (
      <div id="deposit-test" className="deposit-test-wrapper">
        <DepositTestPage />
      </div>
    );
  }

    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    // Event emitted from the PhaserGame component
    const currentScene = (scene: Phaser.Scene) => {
        console.log('Current scene:', scene.scene.key);
  };

    return (
        <div id="app" className="fullscreen">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
        </div>
  );
}

export default App;
