import { AUTO, Game, Scale } from 'phaser';
import { GAME_INFO } from '../configs/game';
import { LoadingScene } from './scenes/LoadingScene';
// import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { getOptimalDevicePixelRatio, getOptimalTargetFPS } from '../utils/device';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        // 🚀 PERFORMANCE: Use optimal devicePixelRatio based on OS (Mac handles high DPI better than Windows)
        width: window.innerWidth * getOptimalDevicePixelRatio(),
        height: window.innerHeight * getOptimalDevicePixelRatio()
    },
    title: GAME_INFO.name,
    scene: [
        LoadingScene,
        // MenuScene,
        GameScene
    ],
    // Enhanced graphics settings
    pixelArt: false, // Set to true for pixel art games
    roundPixels: false, // Prevents pixel interpolation for pixel art
    // Enable antialiasing for crisp text rendering
    antialias: true, // Enabled for sharp text
    antialiasGL: true, // Enabled for sharp text
    desynchronized: true, // Reduces input lag
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            fps: 60
        }
    },
    dom: {
        createContainer: true
    },
    render: {
        transparent: false,
        clearBeforeRender: true,
        powerPreference: 'high-performance'
    },
    fps: {
        // 🚀 PERFORMANCE: Use optimal FPS based on OS (Mac: 120fps, Windows: 60fps for stability)
        target: getOptimalTargetFPS(),
        forceSetTimeOut: false,
        smoothStep: true // Enable frame smoothing
    }
};

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });
    // Set canvas resolution after game creation
    // game.canvas.style.width = '100%';
    // game.canvas.style.height = '100%';
    return game;
}

export { StartGame };
