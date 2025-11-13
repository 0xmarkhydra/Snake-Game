import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { authService } from '../../services/AuthService';

export class LoadingScene extends Scene {
    constructor() {
        super('LoadingScene');
    }

    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Loading text
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Progress bar background
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);
        
        // Register progress events
        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 + 10, 300 * value, 10);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            
            // Generate textures instead of loading images
            this.generateTextures();
            
            // Create dummy sound objects
            // this.createDummySounds();
            
            // Move to the menu scene directly
            this.scene.start('MenuScene', { isAuthenticated: authService.isAuthenticated() });
        });

        // Load audio files
        this.load.audio('eat', 'sounds/eat.mp3');
        this.load.audio('death', 'sounds/death.wav');
        this.load.audio('boost', 'sounds/eat.mp3'); // Reusing eat sound for boost
        this.load.audio('background', 'sounds/background.mp3'); // Add background music
        this.load.svg('game-background', 'images/background.svg', { width: 1080, height: 1080 });
    }

    // private createDummySounds() {
    //     // Create dummy sound objects that do nothing when played
    //     const dummySound = {
    //         play: () => {},
    //         stop: () => {},
    //         pause: () => {},
    //         resume: () => {},
    //         destroy: () => {}
    //     };
        
    //     // Add these to the game's sound manager
    //     this.sound.sounds = this.sound.sounds || [];
        
    //     // Create a method to return our dummy sound
    //     const originalAdd = this.sound.add;
    //     this.sound.add = function(key: string) {
    //         return dummySound;
    //     };
        
    //     // Create references to our sounds
    //     this.sound.add('eat');
    //     this.sound.add('death');
    // }

    private generateTextures() {
        // Generate snake head texture
        this.generateSnakeHeadTexture();
        
        // Generate snake body texture
        this.generateSnakeBodyTexture();
        
        // Generate food textures
        this.generateFoodTexture();
        this.generateSpecialFoodTexture();
    }
    
    private generateSnakeHeadTexture() {
        // Create a graphics object for the snake head
        const headGraphics = this.add.graphics({ x: 0, y: 0 });
        headGraphics.setVisible(false);
        
        // Draw a circle for the head
        headGraphics.fillStyle(0xffffff);
        headGraphics.fillCircle(16, 16, 16);
        
        // Add eyes
        headGraphics.fillStyle(0x000000);
        headGraphics.fillCircle(22, 10, 4);
        headGraphics.fillCircle(22, 22, 4);
        
        // Generate texture
        headGraphics.generateTexture('snake-head', 28, 28);
        headGraphics.destroy();
    }
    
    private generateSnakeBodyTexture() {
        // Create a graphics object for the snake body
        const bodyGraphics = this.add.graphics({ x: 0, y: 0 });
        bodyGraphics.setVisible(false);
        
        // Draw a circle for the body segment
        bodyGraphics.fillStyle(0xffffff);
        bodyGraphics.fillCircle(12, 12, 12);
        
        // Generate texture
        bodyGraphics.generateTexture('snake-body', 24, 24);
        bodyGraphics.destroy();
    }
    
    private generateFoodTexture() {
        // Create a graphics object for the food
        const foodGraphics = this.add.graphics({ x: 0, y: 0 });
        foodGraphics.setVisible(false);
        
        // Draw a circle for the food
        foodGraphics.fillStyle(0xff0000);
        foodGraphics.fillCircle(8, 8, 8);
        
        // Generate texture
        foodGraphics.generateTexture('food', 16, 16);
        foodGraphics.destroy();
    }
    
    private generateSpecialFoodTexture() {
        // Create a graphics object for the special food
        const specialFoodGraphics = this.add.graphics({ x: 0, y: 0 });
        specialFoodGraphics.setVisible(false);

        const size = 90;
        const center = size / 2;

        // Outer glow
        specialFoodGraphics.fillStyle(0xffff66, 0.65);
        specialFoodGraphics.fillCircle(center, center, 28);

        // Mid glow
        specialFoodGraphics.fillStyle(0xffff99, 0.65);
        specialFoodGraphics.fillCircle(center, center, 24);

        // Inner glow
        specialFoodGraphics.fillStyle(0xfff5cc, 0.95);
        specialFoodGraphics.fillCircle(center, center, 20);

        // Core
        specialFoodGraphics.fillStyle(0xffc93c, 3);
        specialFoodGraphics.fillCircle(center, center, 20);

        // Generate texture
        specialFoodGraphics.generateTexture('special-food', size, size);
        specialFoodGraphics.destroy();
    }

    create() {
        // Notify that the scene is ready
        EventBus.emit('current-scene-ready', this);
    }
} 