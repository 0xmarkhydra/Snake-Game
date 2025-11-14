import { AUTO, Game, Scale } from 'phaser';
import { GAME_INFO } from '../configs/game';
import { LoadingScene } from './scenes/LoadingScene';
// import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

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
        // 🚀 PERFORMANCE: Cap devicePixelRatio to max 2 to avoid excessive resolution on high-DPI displays
        width: window.innerWidth * Math.min(window.devicePixelRatio || 1, 2),
        height: window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)
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
    // 🚀 PERFORMANCE: Disable antialiasing for better performance on high resolution
    antialias: false, // Disabled for performance
    antialiasGL: false, // Disabled for performance
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
        // 🚀 MOBILE OPTIMIZATION: Lower target FPS on mobile for better performance
        target: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768 ? 60 : 120,
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
