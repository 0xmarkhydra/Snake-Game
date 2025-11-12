import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { colyseusClient } from '../../services/ColyseusClient';
import { Room } from 'colyseus.js';
import { Player } from '../../types/SchemaTypes';
import { authService } from '../../services/AuthService';
import type { RoomType, VipRoomConfig } from '../../types/Game.types';

interface GameSceneData {
    playerName: string;
    skinId: number;
    roomType?: RoomType;
    vipTicketId?: string;
    vipTicketCode?: string;
    vipConfig?: VipRoomConfig;
    vipCredit?: number;
    isAuthenticated?: boolean;
}

export class GameScene extends Scene {
    // Game state
    private room: Room | null = null;
    private playerId: string;
    private playerName: string;
    private skinId: number;
    private gameState: any;
    private roomType: RoomType = 'free';
    private vipTicketId?: string;
    private vipTicketCode?: string;
    private vipCredit: number = 0;
    private vipConfig?: VipRoomConfig;
    private lastUpdateTime: number = 0;
    
    // Game objects
    private snakes: Map<string, Phaser.GameObjects.Group> = new Map();
    private foods: Map<string, Phaser.GameObjects.Container> = new Map();
    private playerTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    
    // Camera and world
    private worldWidth: number = 8000;
    private worldHeight: number = 8000;
    
    // UI elements
    private scoreText: Phaser.GameObjects.Text;
    private leaderboardPanel: Phaser.GameObjects.Container;
    private minimap: Phaser.GameObjects.Graphics;
    private deathOverlay: Phaser.GameObjects.Container;
    private vipCreditText?: Phaser.GameObjects.Text;
    private vipInfoText?: Phaser.GameObjects.Text;
    
    // Input
    private pointer: Phaser.Input.Pointer;
    
    // Audio
    private eatSound: Phaser.Sound.BaseSound;
    private deathSound: Phaser.Sound.BaseSound;
    private boostSound: Phaser.Sound.BaseSound;
    
    // Add FPS counter
    private fpsText: Phaser.GameObjects.Text;
    private fpsUpdateTime: number = 0;
    
    // Add these properties to the class
    private targetCameraX: number = 0;
    private targetCameraY: number = 0;
    private cameraLerpFactor: number = 0.1; // Adjust between 0.05-0.2 for different smoothness
    
    // Add these properties to the class
    private respawnButton: Phaser.GameObjects.Text;
    private menuButton: Phaser.GameObjects.Text;
    
    // Add these properties to the class
    private isBoosting: boolean = false;
    private boostEffect: Phaser.GameObjects.Particles.ParticleEmitter;
    
    // Add this new property
    private playerCountText: Phaser.GameObjects.Text;
    
    // Add this property to the class
    private backgroundMusic: Phaser.Sound.BaseSound;
    
    // Add this property to the class
    private playerRankText: Phaser.GameObjects.Text;

    // Quit state
    private isQuitting: boolean = false;
    
    // Add these properties to the class
    private segmentSpacing: number = 12; // Base minimum spacing between segments
    private playerSegmentHistories: Map<string, Array<{x: number, y: number}>> = new Map(); // Store histories for all players
    private historySize: number = 500; // Maximum history size
    private idleHistoryInterval: number = 100; // ms between duplicate history entries when idle
    private playerLastHistoryUpdate: Map<string, number> = new Map();
    
    // Add this new property
    private killNotifications: Phaser.GameObjects.Container[] = [];
    
    // Add this new property
    private statsPanel: Phaser.GameObjects.Container;
    
    // Add this property to the class
    private lastAngle: number = 0;
    private maxAngleChange: number = 7; // Increased from 10 to 20 degrees per frame
    
    // Add this property to the GameScene class
    private invulnerableUntil: number = 0;
    
    private readonly foodColors: number[] = [
        0x2ecc71, // green
        0xe74c3c, // red
        0xf1c40f, // yellow
        0x9b59b6, // purple
        0xff69b4  // pink
    ];
    
    constructor() {
        super({
            key: 'GameScene',
            physics: {
                default: 'arcade',
                arcade: {
                    debug: false
                }
            }
        });
    }
    
    init(data: GameSceneData) {
        this.playerName = data.playerName || 'Player';
        this.skinId = data.skinId || 0;
        this.roomType = data.roomType ?? 'free';
        this.vipTicketId = data.vipTicketId;
        this.vipTicketCode = data.vipTicketCode;
        this.vipConfig = data.vipConfig;
        this.vipCredit = data.vipCredit ?? 0;
        this.room = null;
        this.isQuitting = false;
    }
    
    async create() {
        // Set up world bounds - with safety check
        this.cameras.main?.setBounds(0, 0, this.worldWidth, this.worldHeight);
        
        // Add safety check for physics world
        if (this.physics && this.physics.world) {
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        } else {
            console.warn('Physics system not available, skipping world bounds setup');
        }
        
        // Create background
        this.createBackground();
        
        // Set up input
        this.pointer = this.input.activePointer;
        
        // Set up UI
        this.createUI();

        if (this.roomType === 'vip') {
            this.updateVipCreditDisplay(this.vipCredit);
            this.updateVipInfoText();
        }
        
        // Set up audio
        this.setupAudio();
        
        // Set up input for boost
        this.input.on('pointerdown', () => {
            this.startBoost();
        });
        
        this.input.on('pointerup', () => {
            this.stopBoost();
        });
        
        // Create boost particle effect
        this.createBoostEffect();
        
        // Connect to server
        try {
            const roomName = this.roomType === 'vip' ? 'snake_game_vip' : 'snake_game';
            const joinOptions: Record<string, unknown> = {
                name: this.playerName,
                skinId: this.skinId,
            };

            if (this.roomType === 'vip') {
                if (!this.vipTicketId) {
                    throw new Error('Missing VIP ticket. Please rejoin from the menu.');
                }
                joinOptions.ticketId = this.vipTicketId;
                joinOptions.ticketCode = this.vipTicketCode;
                const token = authService.getAccessToken();
                if (token) {
                    joinOptions.jwt = token;
                }
            }

            this.isQuitting = false;
            const room = await colyseusClient.joinOrCreate(roomName, joinOptions);
            this.room = room;
            
            this.playerId = room.sessionId;
            
            // Set up room event handlers
            this.setupRoomHandlers(room);
            
            // Notify that the scene is ready
            EventBus.emit('current-scene-ready', this);
            
            console.log('Connected to game server!');
        } catch (error) {
            console.error('Failed to connect to game server:', error);
            // Emit event to return to React menu
            EventBus.emit('game-exit');
        }
    }
    
    update(time: number, delta: number) {
        // Skip if not connected yet
        const room = this.room;
        if (!room || !this.gameState || this.isQuitting) return;
        
        // Update FPS counter every 500ms
        if (time - this.fpsUpdateTime > 500) {
            this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
            this.fpsUpdateTime = time;
        }
        
        // Update game objects every frame for smoother animations
        this.updateSnakes();
        this.updateFoods();
        this.updatePlayerTexts();
        
        // Calculate angle from player's snake head to mouse pointer
        const player = this.gameState.players.get(this.playerId);
        if (player && player.alive) {
            // Use headPosition instead of segments[0]
            const headPosition = player.headPosition;
            if (!headPosition) return;
            
            // Convert screen coordinates to world coordinates
            const worldX = this.cameras.main.scrollX + this.pointer.x;
            const worldY = this.cameras.main.scrollY + this.pointer.y;
            
            // Calculate angle
            const angle = Phaser.Math.Angle.Between(
                headPosition.x, 
                headPosition.y,
                worldX,
                worldY
            );
            
            // Convert to degrees
            let angleDeg = Phaser.Math.RadToDeg(angle);
            
            // Apply angle smoothing - limit the maximum angle change per frame
            if (this.lastAngle !== undefined) {
                // Calculate the difference between current and last angle
                let angleDiff = angleDeg - this.lastAngle;
                
                // Normalize the difference to handle the -180/180 boundary
                if (angleDiff > 180) angleDiff -= 360;
                if (angleDiff < -180) angleDiff += 360;
                
                // Limit the angle change to maxAngleChange
                // Reduce the limiting effect when the player is boosting for more responsive turns
                const effectiveMaxAngleChange = player.boosting ? this.maxAngleChange * 1.5 : this.maxAngleChange;
                
                if (Math.abs(angleDiff) > effectiveMaxAngleChange) {
                    const sign = Math.sign(angleDiff);
                    angleDeg = this.lastAngle + (sign * effectiveMaxAngleChange);
                }
            }
            
            // Update the last angle
            this.lastAngle = angleDeg;
            
            // Send movement input to server
            room.send('move', { angle: angleDeg });
            
            // Update boost effect position if boosting
            if (player.boosting) {
                this.updateBoostEffect(headPosition.x, headPosition.y, angleDeg);
            }
            
            // Apply food attraction logic
            this.attractFoodInFront(headPosition.x, headPosition.y, angleDeg);
        }
        
        // Update minimap
        this.updateMinimap();
        
        // Update leaderboard every second
        if (time - this.lastUpdateTime > 1000) { // Update every second
            this.updateLeaderboard();
            this.lastUpdateTime = time;
        }
        
        this.updateCamera();
        
        // Remove the checkPlayerCollisions() call and keep only the visual effect for invulnerability
        if (time < this.invulnerableUntil) {
            const player = this.gameState.players.get(this.playerId);
            if (player && player.alive) {
                const snake = this.snakes.get(this.playerId);
                if (snake) {
                    // Make the snake flash during invulnerability
                    const isVisible = Math.floor(time / 150) % 2 === 0;
                    snake.setAlpha(isVisible ? 1 : 0.3);
                }
            }
        } else {
            // Ensure normal visibility when not invulnerable
            const snake = this.snakes.get(this.playerId);
            if (snake) {
                snake.setAlpha(1);
            }
        }
    }
    
    private setupRoomHandlers(room: Room) {
        // Handle state changes
        room.onStateChange((state) => {
            this.gameState = state;
            
            // Update world size
            this.worldWidth = state.worldWidth;
            this.worldHeight = state.worldHeight;
            this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
            
            // Add safety check for physics world
            if (this.physics && this.physics.world) {
                this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            }
            
            // Update UI
            this.updateScore();
            this.updateLeaderboard();
            
            // Modify the onRoomStateChange handler to update segment count
            this.onRoomStateChange();
        });
        
        // Handle player died event
        room.onMessage('playerDied', (message) => {
            if (message.playerId === this.playerId) {
                this.handlePlayerDeath();
            }
            
            // Play death sound
            this.deathSound.play();
        });
        
        // Handle initial foods message
        room.onMessage('initialFoods', (message) => {
            console.log(`Received ${message.foods.length} initial foods`);
            
            // Clear existing foods
            this.foods.forEach(food => food.destroy());
            this.foods.clear();
            
            // Add all initial foods
            message.foods.forEach((food: any) => {
                const foodSprite = this.createFoodSprite(food.id, food.position.x, food.position.y, food.value);
                this.foods.set(food.id, foodSprite);
            });
        });
        
        // Add handler for food spawned
        room.onMessage("foodSpawned", (message) => {
            // Create food sprite if it doesn't exist
            if (!this.foods.has(message.id)) {
                const foodSprite = this.createFoodSprite(message.id, message.position.x, message.position.y, message.value);
                this.foods.set(message.id, foodSprite);
            }
        });
        
        // Add handler for food consumed
        room.onMessage("foodConsumed", (message) => {
            // Remove food sprite if it exists
            const foodSprite = this.foods.get(message.id);
            if (foodSprite) {
                foodSprite.destroy();
                this.foods.delete(message.id);
                
                // Play eat sound only if it's the current player who ate the food
                if (message.playerId === this.playerId) {
                    this.eatSound.play({ volume: 0.5 });
                }
            }
        });
        
        // Add a specific handler for playerKilled events
        room.onMessage('playerKilled', (message) => {
            console.log('Received playerKilled event:', message);
            
            if (message && message.killer && message.killed) {
                this.showKillNotification(message.killer, message.killed);
            } else {
                console.error('Invalid playerKilled message format:', message);
            }
        });
        
        // Add invulnerability when joining
        room.onMessage('welcome', (message) => {
            // Set invulnerability for 3 seconds
            this.invulnerableUntil = this.time.now + 3000;
            console.log('Player is invulnerable until:', this.invulnerableUntil);
        });

        if (this.roomType === 'vip') {
            this.setupVipHandlers(room);
        }
    }

    private setupVipHandlers(room: Room) {
        room.onMessage('vip:credit-updated', (message: { playerId: string; credit: number | string }) => {
            if (message?.playerId === this.playerId) {
                const credit = this.toNumber(message.credit);
                this.updateVipCreditDisplay(credit);
            }
        });

        room.onMessage('vip:reward', (message) => {
            this.handleVipReward(message);
        });

        room.onMessage('vip:error', (message) => {
            if (message?.message) {
                this.showVipNotification(message.message, 0xff5555);
            }
        });

        room.onMessage('vip:config', (message) => {
            if (message) {
                this.vipConfig = this.normalizeVipConfig(message);
                this.updateVipInfoText();
            }
        });
    }
    
    private createBackground() {
        // Create solid dark green/teal background
        const bg = this.add.graphics();
        
        // Fill with dark teal color similar to the reference image
        bg.fillStyle(0x0d4d4d, 1); // Dark teal base color
        bg.fillRect(0, 0, this.worldWidth, this.worldHeight);
        
        // Add darker green overlay for depth
        bg.fillStyle(0x1a3a3a, 0.3);
        bg.fillRect(0, 0, this.worldWidth, this.worldHeight);
        
        // Create hexagon pattern
        this.createHexagonPattern();
    }
    
    private createHexagonPattern() {
        const hexGraphics = this.add.graphics();
        
        // Hexagon settings
        const hexSize = 50; // Size of each hexagon
        const hexWidth = hexSize * 2;
        const hexHeight = Math.sqrt(3) * hexSize;
        const horizontalSpacing = hexWidth * 0.75;
        const verticalSpacing = hexHeight;
        
        // Calculate how many hexagons we need
        const cols = Math.ceil(this.worldWidth / horizontalSpacing) + 2;
        const rows = Math.ceil(this.worldHeight / verticalSpacing) + 2;
        
        // Draw hexagon pattern
        hexGraphics.lineStyle(2, 0x0a3333, 0.2); // Dark teal outline with low opacity
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * horizontalSpacing;
                const y = row * verticalSpacing + (col % 2 === 1 ? verticalSpacing / 2 : 0);
                
                // Draw hexagon
                this.drawHexagon(hexGraphics, x, y, hexSize);
            }
        }
        
        hexGraphics.setDepth(0);
    }
    
    private drawHexagon(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number) {
        const angle = Math.PI / 3; // 60 degrees
        
        graphics.beginPath();
        
        for (let i = 0; i < 6; i++) {
            const xPos = x + size * Math.cos(angle * i);
            const yPos = y + size * Math.sin(angle * i);
            
            if (i === 0) {
                graphics.moveTo(xPos, yPos);
            } else {
                graphics.lineTo(xPos, yPos);
            }
        }
        
        graphics.closePath();
        graphics.strokePath();
    }
    
    private createUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        // Create stats card container
        this.statsPanel = this.add.container(20, 20)
            .setScrollFactor(0)
            .setDepth(100);
        
        // Add background with gradient and rounded corners
        const cardWidth = 200;
        const cardHeight = this.roomType === 'vip' ? 170 : 130;
        const cardBg = this.add.graphics();
        cardBg.fillGradientStyle(
            0x0d2828, 0x0d2828,  // Dark teal at top
            0x081818, 0x081818,  // Darker teal at bottom
            1, 1, 1, 1
        );
        cardBg.fillRoundedRect(0, 0, cardWidth, cardHeight, 10);
        cardBg.lineStyle(2, 0x2d7a7a, 0.8);
        cardBg.strokeRoundedRect(0, 0, cardWidth, cardHeight, 10);
        this.statsPanel.add(cardBg);
        
        // Add title
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x1a5555, 0.8);
        titleBg.fillRoundedRect(0, 0, cardWidth, 30, { tl: 10, tr: 10, bl: 0, br: 0 });
        this.statsPanel.add(titleBg);
        
        const title = this.add.text(cardWidth / 2, 15, 'PLAYER STATS', { 
            fontFamily: 'Arial', 
            fontSize: '16px', 
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        this.statsPanel.add(title);
        
        // Add score with icon
        const scoreIcon = this.add.image(20, 50, 'food')
            .setTint(0xffff00)
            .setScale(1.2);
        this.statsPanel.add(scoreIcon);
        
        this.scoreText = this.add.text(45, 50, 'Score: 0', { 
            fontFamily: 'Arial', 
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.statsPanel.add(this.scoreText);
        
        // Add rank with icon
        const rankIcon = this.add.image(20, 80, 'food')
            .setTint(0x00ffff)
            .setScale(1.2);
        this.statsPanel.add(rankIcon);
        
        this.playerRankText = this.add.text(45, 80, 'Rank: -/-', { 
            fontFamily: 'Arial', 
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.statsPanel.add(this.playerRankText);
        
        // Add FPS counter with icon
        const fpsIcon = this.add.image(20, 110, 'food')
            .setTint(0x00ff00)
            .setScale(1.2);
        this.statsPanel.add(fpsIcon);
        
        this.fpsText = this.add.text(45, 110, 'FPS: 0', { 
            fontFamily: 'Arial', 
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.statsPanel.add(this.fpsText);

        if (this.roomType === 'vip') {
            const vipIcon = this.add.image(20, 140, 'food')
                .setTint(0xffcc00)
                .setScale(1.2);
            this.statsPanel.add(vipIcon);

            this.vipCreditText = this.add.text(45, 140, 'Credit: 0', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffeb8a',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0, 0.5);
            this.statsPanel.add(this.vipCreditText);

            this.vipInfoText = this.add.text(10, cardHeight - 10, '', {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffe9b5',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0, 1);
            this.statsPanel.add(this.vipInfoText);
        }
        
        // Create minimap
        this.createMinimap();
        
        // Quit button
        this.createQuitButton(20, height-80);
    }
    
    private createLeaderboard() {
        const width = this.cameras.main.width;
        
        // Create container for leaderboard - increase top margin even more
        this.leaderboardPanel = this.add.container(width - 110, 80);
        this.leaderboardPanel.setScrollFactor(0);
        this.leaderboardPanel.setDepth(100);
        
        // Background - make it slightly larger and more transparent
        const bg = this.add.rectangle(0, 0, 190, 230, 0x000000, 0.4);
        this.leaderboardPanel.add(bg);
        
        // Title - adjust position and style
        const title = this.add.text(0, -90, 'Leaderboard', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
        this.leaderboardPanel.add(title);
        
        // Placeholder for player entries - increase spacing
        for (let i = 0; i < 5; i++) {
            const entry = this.add.text(
                -80, -50 + i * 35,  // Increased vertical spacing from 30 to 35
                `${i + 1}. ---`,
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 1
                }
            ).setName(`leaderboard-entry-${i}`);
            this.leaderboardPanel.add(entry);
        }
    }
    
    private createMinimap() {
        // Create minimap container
        const minimapSize = 150;
        const margin = 20; // Margin from the edges of the screen
        
        // Create a background for the minimap
        const minimapBg = this.add.graphics();
        minimapBg.fillStyle(0x0d2828, 0.7); // Dark teal background with transparency
        minimapBg.fillRoundedRect(0, 0, minimapSize + 10, minimapSize + 10, 8); // Slightly larger than the minimap with rounded corners
        minimapBg.lineStyle(2, 0x2d7a7a, 0.8); // Teal border
        minimapBg.strokeRoundedRect(0, 0, minimapSize + 10, minimapSize + 10, 8);
        
        // Position the background in the bottom right corner
        minimapBg.setPosition(
            this.cameras.main.width - minimapSize - margin - 5, 
            this.cameras.main.height - minimapSize - margin - 5
        );
        minimapBg.setScrollFactor(0);
        minimapBg.setDepth(90);
        
        // Create the minimap
        this.minimap = this.add.graphics();
        
        // Position the minimap in the bottom right corner, centered within the background
        this.minimap.setPosition(
            this.cameras.main.width - minimapSize - margin, 
            this.cameras.main.height - minimapSize - margin
        );
        this.minimap.setScrollFactor(0);
        this.minimap.setDepth(91);
        
        // Add a title for the minimap
        const minimapTitle = this.add.text(
            this.cameras.main.width - minimapSize/2 - margin,
            this.cameras.main.height - minimapSize - margin - 15,
            'MAP',
            {
                fontFamily: 'Arial',
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(91);
    }
    
    private createDeathOverlay() {
        // Create death overlay container
        this.deathOverlay = this.add.container(0, 0);
        this.deathOverlay.setDepth(1000);
        this.deathOverlay.setScrollFactor(0);
        
        // Add semi-transparent background
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const bg = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7);
        this.deathOverlay.add(bg);
        
        // Add death message
        const deathText = this.add.text(width/2, height/2 - 100, 'YOU DIED', {
            fontFamily: 'Arial',
            fontSize: '64px',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.deathOverlay.add(deathText);
        
        // Add score text with a name so we can find it later
        const scoreText = this.add.text(width/2, height/2, 'Score: 0', {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setName('scoreText');
        this.deathOverlay.add(scoreText);
        
        // Create buttons directly in the scene instead of in the container
        // This ensures they're properly interactive
        
        // Respawn button
        this.respawnButton = this.add.text(width/2, height/2 + 100, 'RESPAWN', {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#990000',
            padding: {
                left: 20,
                right: 20,
                top: 10,
                bottom: 10
            }
        }).setOrigin(0.5);
        
        // Make sure the button is interactive
        this.respawnButton.setInteractive({ useHandCursor: true });
        this.respawnButton.setScrollFactor(0);
        this.respawnButton.setDepth(1001); // Higher than the overlay
        
        // Add hover effects
        this.respawnButton.on('pointerover', () => {
            this.respawnButton.setStyle({ backgroundColor: '#cc0000' });
        });
        
        this.respawnButton.on('pointerout', () => {
            this.respawnButton.setStyle({ backgroundColor: '#990000' });
        });
        
        // Add click handler
        this.respawnButton.on('pointerdown', () => {
            console.log('Respawn button clicked');
            this.respawn();
        });
        
        // Menu button
        this.menuButton = this.add.text(width/2, height/2 + 180, 'BACK TO MENU', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: {
                left: 20,
                right: 20,
                top: 10,
                bottom: 10
            }
        }).setOrigin(0.5);
        
        // Make sure the button is interactive
        this.menuButton.setInteractive({ useHandCursor: true });
        this.menuButton.setScrollFactor(0);
        this.menuButton.setDepth(1001); // Higher than the overlay
        
        // Add hover effects
        this.menuButton.on('pointerover', () => {
            this.menuButton.setStyle({ backgroundColor: '#555555' });
        });
        
        this.menuButton.on('pointerout', () => {
            this.menuButton.setStyle({ backgroundColor: '#333333' });
        });
        
        // Add click handler
        this.menuButton.on('pointerdown', async () => {
            if (this.isQuitting) {
                return;
            }

            console.log('Menu button clicked');
            this.isQuitting = true;

            try {
                await this.leaveRoomSafely();
            } catch (error) {
                console.error('Error leaving room from menu button:', error);
            } finally {
                // Emit event to return to React menu
                EventBus.emit('game-exit');
            }
        });
        
        // Hide everything by default
        this.deathOverlay.setVisible(false);
        this.respawnButton.setVisible(false);
        this.menuButton.setVisible(false);
        
        return this.deathOverlay;
    }
    
    private createBoostEffect() {
        // Create particle emitter for boost effect
        if (this.game.textures.exists('boost-particle')) {
            this.boostEffect = this.add.particles(0, 0, 'boost-particle', {
                lifespan: 200,
                speed: { min: 50, max: 100 },
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                blendMode: 'ADD',
                emitting: false
            });
        } else {
            // Fallback if texture doesn't exist
            console.warn('Boost particle texture not found, using default');
            this.boostEffect = this.add.particles(0, 0, 'food', {
                lifespan: 200,
                speed: { min: 50, max: 100 },
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                blendMode: 'ADD',
                emitting: false
            });
        }
    }
    
    private updateBoostEffect(x: number, y: number, angle: number) {
        if (!this.boostEffect) return;
        
        // Position the emitter behind the snake head
        const offsetX = Math.cos((angle - 180) * Math.PI / 180) * 20;
        const offsetY = Math.sin((angle - 180) * Math.PI / 180) * 20;
        
        this.boostEffect.setPosition(x + offsetX, y + offsetY);
        this.boostEffect.setEmitterAngle(angle - 180);
    }
    
    private startBoost() {
        const room = this.room;
        if (!room || this.isQuitting) return;
        
        this.isBoosting = true;
        room.send('boost', true);
        
        // Play boost sound
        this.boostSound.play({ volume: 0.3 });
        
        // Start particle effect
        if (this.boostEffect) {
            this.boostEffect.start();
        }
    }
    
    private stopBoost() {
        const room = this.room;
        if (!room || this.isQuitting) return;
        
        this.isBoosting = false;
        room.send('boost', false);
        
        // Stop particle effect
        if (this.boostEffect) {
            this.boostEffect.stop();
        }
    }
    
    private updateSnakes() {
        if (!this.gameState) return;
        
        // First, remove snakes that are no longer in the game
        this.snakes.forEach((snake, id) => {
            const player = this.gameState.players.get(id);
            if (!player || !player.alive) {
                // Destroy all segments
                snake.destroy(true);
                this.snakes.delete(id);
                
                // Remove player name
                const playerText = this.playerTexts.get(id);
                if (playerText) {
                    playerText.destroy();
                    this.playerTexts.delete(id);
                }
                
                // Remove segment history
                this.playerSegmentHistories.delete(id);
            this.playerLastHistoryUpdate.delete(id);
            }
        });
        
        // Then, update or create snakes
        this.gameState.players.forEach((playerData: any, id: string) => {
            if (!playerData.alive) return;
            
            // Get color and skin
            const color = playerData.color || '#ffffff';
            const skinId = playerData.skinId || 0;
            
            // Get or create snake group
            let snake = this.snakes.get(id) as Phaser.GameObjects.Group | undefined;
            let createdNewSnake = false;

            if (!snake || !(snake as any).children) {
                if (snake && !(snake as any).children) {
                    snake.destroy(true);
                }
                snake = this.add.group();
                this.snakes.set(id, snake);
                createdNewSnake = true;
            }

            let nameText = this.playerTexts.get(id);
            if (!nameText || !nameText.scene) {
                if (nameText) {
                    nameText.destroy();
                }
                nameText = this.add.text(0, 0, playerData.name, {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4,
                    shadow: {
                        offsetX: 2,
                        offsetY: 2,
                        color: '#000000',
                        blur: 5,
                        stroke: true,
                        fill: true
                    }
                }).setOrigin(0.5, 0.5);
                nameText.setDepth(100);
                this.playerTexts.set(id, nameText);
            } else {
                nameText.setText(playerData.name);
            }
            
            if (createdNewSnake && snake) {
                const initialSegments = 5;
                for (let i = 0; i < initialSegments; i++) {
                    const isHead = i === 0;
                    const segment = this.add.graphics();
                    segment.setData('isHead', isHead);
                    segment.setData('color', color);
                    segment.setDepth(isHead ? 20 : 10);
                    snake.add(segment);
                }
            }
            if (!snake) {
                return;
            }

            // Ensure we have the right number of segments based on score
            const targetSegmentCount = 5 + Math.floor(playerData.score);
            const currentSegmentCount = snake.getChildren().length;
            
            if (currentSegmentCount < targetSegmentCount) {
                // Add segments if needed
                for (let i = currentSegmentCount; i < targetSegmentCount; i++) {
                    // Create graphics object for new segment
                    const segment = this.add.graphics();
                    segment.setData('isHead', false);
                    segment.setData('color', color);
                    segment.setDepth(10);
                    snake.add(segment);
                }
            } else if (currentSegmentCount > targetSegmentCount) {
                // Remove segments if needed
                const children = snake.getChildren();
                for (let i = targetSegmentCount; i < children.length; i++) {
                    children[i].destroy();
                }
            }
            
            // Get the head position from the server
            const headPosition = playerData.headPosition;
            if (!headPosition) return;
            
            // Get or create segment history for this player
            let segmentHistory = this.playerSegmentHistories.get(id);
            if (!segmentHistory) {
                segmentHistory = [];
                this.playerSegmentHistories.set(id, segmentHistory);
            }
            
            this.addHeadPosition(id, segmentHistory, headPosition.x, headPosition.y);
            
            // Update head position
            const children = snake.getChildren();
            const headObj = children[0] as Phaser.GameObjects.Graphics;
            
            if (headObj) {
                // Apply interpolation for smoother movement while keeping head leading
                // Calculate base scale based on score
                const baseScale = Math.min(1.5, 1 + (playerData.score / 100));
                const segmentRadius = 18 * baseScale;
                const segmentSpacingDistance = Math.max(this.segmentSpacing, segmentRadius * 0.65);
                const maxBodyDistance = segmentSpacingDistance * Math.max(children.length - 1, 1);
                const availableDistance = this.getHistoryTotalDistance(segmentHistory, maxBodyDistance);
                
                const currentX = headObj.x;
                const currentY = headObj.y;
                const headDistance = Phaser.Math.Distance.Between(currentX, currentY, headPosition.x, headPosition.y);
                
                if (headDistance > segmentRadius * 1.2) {
                    headObj.setPosition(headPosition.x, headPosition.y);
                } else {
                    const lerpFactor = Phaser.Math.Clamp(
                        headDistance / (segmentRadius * 0.75),
                        0.35,
                        0.8
                    );
                    const newX = currentX + (headPosition.x - currentX) * lerpFactor;
                    const newY = currentY + (headPosition.y - currentY) * lerpFactor;
                    headObj.setPosition(newX, newY);
                }
                
                // Clear and redraw head
                headObj.clear();
                
                // Draw head with outline
                const colorInt = parseInt(color.replace('#', '0x'));
                const applyRadialShading = (
                    graphics: Phaser.GameObjects.Graphics,
                    baseColor: number,
                    radius: number,
                    intensity: number
                ) => {
                    const steps = 6;
                    const baseColorObj = Phaser.Display.Color.ValueToColor(baseColor);
                    const blackColorObj = Phaser.Display.Color.ValueToColor(0x000000);
                    const whiteColorObj = Phaser.Display.Color.ValueToColor(0xffffff);
                    
                    for (let step = 0; step < steps; step++) {
                        const t = step / (steps - 1); // 0: outer edge, 1: centre
                        const darkRatio = Phaser.Math.Clamp((1 - t) * intensity, 0, 1);
                        const lightRatio = Phaser.Math.Clamp(t * intensity * 0.6, 0, 1);
                        
                        const darkMix = Phaser.Display.Color.Interpolate.ColorWithColor(
                            baseColorObj,
                            blackColorObj,
                            100,
                            Math.floor(darkRatio * 100)
                        );
                        const darkMixColor = Phaser.Display.Color.ValueToColor(
                            Phaser.Display.Color.GetColor(darkMix.r, darkMix.g, darkMix.b)
                        );
                        
                        const finalMix = Phaser.Display.Color.Interpolate.ColorWithColor(
                            darkMixColor,
                            whiteColorObj,
                            100,
                            Math.floor(lightRatio * 100)
                        );
                        const finalColor = Phaser.Display.Color.GetColor(
                            finalMix.r,
                            finalMix.g,
                            finalMix.b
                        );
                        
                        const layerRadius = radius * (1 - t * 0.4);
                        const alpha = Phaser.Math.Clamp(0.42 - t * 0.24, 0.08, 0.42);
                        graphics.fillStyle(finalColor, alpha);
                        graphics.fillCircle(0, 0, layerRadius);
                    }
                };
                
                // Add glow effect for boosting
                if (playerData.boosting) {
                    headObj.fillStyle(colorInt, 0.3);
                    headObj.fillCircle(0, 0, segmentRadius * 1.3);
                }
                
                applyRadialShading(headObj, colorInt, segmentRadius, 0.85);
                
                headObj.lineStyle(2, 0x000000, 0.12);
                headObj.strokeCircle(0, 0, segmentRadius);
                
                // Draw eyes
                this.drawSnakeEyes(headObj, playerData.angle, segmentRadius);
                
                // Update all other segments based on history
                for (let i = 1; i < children.length; i++) {
                    const segmentObj = children[i] as Phaser.GameObjects.Graphics;
                    if (!segmentObj) continue;
                    
                    const targetDistance = Math.min(i * segmentSpacingDistance, availableDistance);
                    const historyPoint = this.getPositionAlongHistory(segmentHistory, targetDistance);
                    if (!historyPoint) continue;
                    
                    // Apply interpolation for smoother movement
                    const currentX = segmentObj.x;
                    const currentY = segmentObj.y;
                    const distToTarget = Phaser.Math.Distance.Between(currentX, currentY, historyPoint.x, historyPoint.y);
                    
                    let lerpFactor = Math.max(0.12, 0.3 - (i * 0.01));
                    
                    if (distToTarget > segmentSpacingDistance * 0.9) {
                        const catchUpBoost = Phaser.Math.Clamp(distToTarget / (segmentSpacingDistance * 3), 0, 1);
                        if (i <= 3) {
                            lerpFactor = Math.max(lerpFactor, 0.4 + catchUpBoost * 0.25);
                        } else if (i <= 6) {
                            lerpFactor = Math.max(lerpFactor, 0.45 + catchUpBoost * 0.3);
                        } else {
                            lerpFactor = Math.max(lerpFactor, 0.35 + catchUpBoost * 0.25);
                        }
                    }
                    
                    if (i <= 3) {
                        lerpFactor = Math.min(lerpFactor, 0.5);
                    }
                    
                    if (i <= 3 && distToTarget > segmentSpacingDistance * 2) {
                        segmentObj.setPosition(historyPoint.x, historyPoint.y);
                    } else {
                        const newX = currentX + (historyPoint.x - currentX) * lerpFactor;
                        const newY = currentY + (historyPoint.y - currentY) * lerpFactor;
                        segmentObj.setPosition(newX, newY);
                    }
                    
                    // Apply scale based on position in snake
                    const segmentScale = baseScale;
                    const scaledRadius = 18 * segmentScale;
                    
                    // Clear and redraw segment
                    segmentObj.clear();
                    
                    applyRadialShading(segmentObj, colorInt, scaledRadius, 0.75);
                    
                    // Add inner shadow towards previous segment for seamless overlap
                    const prevSegment = children[i - 1] as Phaser.GameObjects.Graphics | undefined;
                    if (prevSegment) {
                        const shadowVector = new Phaser.Math.Vector2(prevSegment.x - segmentObj.x, prevSegment.y - segmentObj.y);
                        if (shadowVector.lengthSq() > 0.0001) {
                            shadowVector.normalize().scale(scaledRadius * 0.35);
                            segmentObj.fillStyle(0x000000, 0.12);
                            segmentObj.fillCircle(shadowVector.x * 0.6, shadowVector.y * 0.6, scaledRadius * 0.82);
                        }
                    }
                    
                    // Draw body segment outline
                    segmentObj.lineStyle(2, 0x000000, 0.12);
                    segmentObj.strokeCircle(0, 0, scaledRadius);
                }
            }
        });
    }

    private getHistoryTotalDistance(
        history: Array<{ x: number; y: number }>,
        maxDistance?: number
    ): number {
        if (history.length < 2) {
            return 0;
        }
        
        let total = 0;
        
        for (let i = 0; i < history.length - 1; i++) {
            total += Phaser.Math.Distance.Between(
                history[i].x,
                history[i].y,
                history[i + 1].x,
                history[i + 1].y
            );
            
            if (maxDistance !== undefined && total >= maxDistance) {
                return maxDistance;
            }
        }
        
        return total;
    }
    
    private addHeadPosition(
        playerId: string,
        history: Array<{ x: number; y: number }>,
        x: number,
        y: number
    ) {
        const now = this.time.now;
        const lastUpdate = this.playerLastHistoryUpdate.get(playerId) ?? 0;
        
        if (history.length === 0) {
            history.unshift({ x, y });
            this.playerLastHistoryUpdate.set(playerId, now);
            return;
        }
        
        const lastPoint = history[0];
        const distance = Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, x, y);
        
        if (distance === 0) {
            if (now - lastUpdate >= this.idleHistoryInterval) {
                history.unshift({ x, y });
                this.playerLastHistoryUpdate.set(playerId, now);
                
                if (history.length > this.historySize) {
                    history.pop();
                }
            }
            return;
        }
        
        const maxStep = Math.max(this.segmentSpacing * 0.4, 2);
        const steps = Math.max(1, Math.ceil(distance / maxStep));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            history.unshift({
                x: Phaser.Math.Linear(lastPoint.x, x, t),
                y: Phaser.Math.Linear(lastPoint.y, y, t)
            });
        }
        
        this.playerLastHistoryUpdate.set(playerId, now);
        
        while (history.length > this.historySize) {
            history.pop();
        }
    }
    
    private getPositionAlongHistory(
        history: Array<{ x: number; y: number }>,
        targetDistance: number
    ): { x: number; y: number } | null {
        if (history.length === 0) {
            return null;
        }
        
        if (history.length === 1 || targetDistance <= 0) {
            return history[0];
        }
        
        let accumulatedDistance = 0;
        
        for (let i = 0; i < history.length - 1; i++) {
            const currentPoint = history[i];
            const nextPoint = history[i + 1];
            
            const segmentDistance = Phaser.Math.Distance.Between(
                currentPoint.x,
                currentPoint.y,
                nextPoint.x,
                nextPoint.y
            );
            
            if (accumulatedDistance + segmentDistance >= targetDistance) {
                const remaining = targetDistance - accumulatedDistance;
                const t = segmentDistance === 0 ? 0 : remaining / segmentDistance;
                
                return {
                    x: Phaser.Math.Linear(currentPoint.x, nextPoint.x, t),
                    y: Phaser.Math.Linear(currentPoint.y, nextPoint.y, t)
                };
            }
            
            accumulatedDistance += segmentDistance;
        }
        
        return history[history.length - 1];
    }
    
    private drawSnakeEyes(graphics: Phaser.GameObjects.Graphics, angle: number, headRadius: number) {
        // Calculate eye positions based on snake direction
        const angleRad = Phaser.Math.DegToRad(angle);
        const eyeDistance = headRadius * 0.4; // Distance from center
        const eyeRadius = headRadius * 0.2; // Eye size
        
        // Calculate positions for both eyes (left and right of center)
        const perpAngle = angleRad + Math.PI / 2; // Perpendicular to direction
        
        // Left eye
        const leftEyeX = Math.cos(perpAngle) * eyeDistance;
        const leftEyeY = Math.sin(perpAngle) * eyeDistance;
        
        // Right eye  
        const rightEyeX = Math.cos(perpAngle + Math.PI) * eyeDistance;
        const rightEyeY = Math.sin(perpAngle + Math.PI) * eyeDistance;
        
        // Move eyes slightly forward
        const forwardOffset = headRadius * 0.3;
        const forwardX = Math.cos(angleRad) * forwardOffset;
        const forwardY = Math.sin(angleRad) * forwardOffset;
        
        // Draw left eye
        graphics.fillStyle(0xffffff, 1); // White
        graphics.fillCircle(leftEyeX + forwardX, leftEyeY + forwardY, eyeRadius);
        graphics.fillStyle(0x000000, 1); // Black pupil
        graphics.fillCircle(leftEyeX + forwardX, leftEyeY + forwardY, eyeRadius * 0.6);
        
        // Draw right eye
        graphics.fillStyle(0xffffff, 1); // White
        graphics.fillCircle(rightEyeX + forwardX, rightEyeY + forwardY, eyeRadius);
        graphics.fillStyle(0x000000, 1); // Black pupil
        graphics.fillCircle(rightEyeX + forwardX, rightEyeY + forwardY, eyeRadius * 0.6);
    }
    
    private addTrailParticle(x: number, y: number, color: string) {
        const particle = this.add.circle(x, y, 5, parseInt(color.replace('#', '0x')), 0.7);
        particle.setDepth(5); // Below snake segments
        
        // Add fade out and scale down effect
        this.tweens.add({
            targets: particle,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                particle.destroy();
            }
        });
    }
    
    private updateFoods() {
        if (!this.gameState || !this.gameState.foods) return;
        
        this.foods.forEach((foodSprite, foodId) => {
            if (!this.gameState.foods.has(foodId)) {
                const rotationTween = foodSprite.getData('rotationTween') as Phaser.Tweens.Tween | undefined;
                if (rotationTween) {
                    rotationTween.stop();
                    foodSprite.setData('rotationTween', null);
                }
                
                foodSprite.destroy(true);
                this.foods.delete(foodId);
            }
        });
        
        this.gameState.foods.forEach((foodData: any, foodId: string) => {
            if (!foodData || !foodData.position) {
                console.warn(`Food ${foodId} has invalid data:`, foodData);
                return;
            }
            
            const { position, value } = foodData;
            
            if (position.x === undefined || position.y === undefined) {
                console.warn(`Food ${foodId} has invalid position:`, position);
                return;
            }
            
            if (!this.foods.has(foodId)) {
                const foodSprite = this.createFoodSprite(foodId, position.x, position.y, value);
                this.foods.set(foodId, foodSprite);
            } else {
                const foodSprite = this.foods.get(foodId);
                if (!foodSprite) {
                    return;
                }
                
                foodSprite.setPosition(position.x, position.y);
                
                const previousValue = foodSprite.getData('value');
                if (previousValue !== value) {
                    foodSprite.setData('value', value);
                    this.updateFoodSpecialState(foodSprite, value > 1);
                }
            }
        });
    }
    
    private createFoodSprite(id: string, x: number, y: number, value: number): Phaser.GameObjects.Container {
        const foodContainer = this.add.container(x, y);
        foodContainer.setDepth(5);
        
        const color = Phaser.Math.RND.pick(this.foodColors);
        const isSpecial = value > 1;
        const baseRadius = 12;
        
        const glow = this.add.circle(0, 0, baseRadius + 6, color, 0.35)
            .setBlendMode(Phaser.BlendModes.ADD);
        const border = this.add.circle(0, 0, baseRadius + 2, color, 0);
        border.setStrokeStyle(3, color, 0.95);
        const body = this.add.circle(0, 0, baseRadius - 2, color, 1);
        const highlight = this.add.circle(-baseRadius * 0.35, -baseRadius * 0.35, baseRadius * 0.45, 0xffffff, 0.45);
        
        foodContainer.add([glow, border, body, highlight]);
        foodContainer.setData('id', id);
        foodContainer.setData('value', value);
        foodContainer.setData('color', color);
        foodContainer.setData('glow', glow);
        foodContainer.setData('border', border);
        foodContainer.setData('body', body);
        
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.25, to: 0.7 },
            scale: { from: 0.95, to: 1.1 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.tweens.add({
            targets: foodContainer,
            scale: { from: 0.9, to: 1.15 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.updateFoodSpecialState(foodContainer, isSpecial);
        
        return foodContainer;
    }
    
    private updateFoodSpecialState(foodSprite: Phaser.GameObjects.Container, isSpecial: boolean): void {
        const glow = foodSprite.getData('glow') as Phaser.GameObjects.Arc | undefined;
        const border = foodSprite.getData('border') as Phaser.GameObjects.Arc | undefined;
        const body = foodSprite.getData('body') as Phaser.GameObjects.Arc | undefined;
        const color = foodSprite.getData('color') as number | undefined;
        const currentRotationTween = foodSprite.getData('rotationTween') as Phaser.Tweens.Tween | undefined;
        
        if (currentRotationTween) {
            currentRotationTween.stop();
            foodSprite.setData('rotationTween', null);
        }
        
        foodSprite.setData('isSpecial', isSpecial);
        
        if (glow) {
            glow.setAlpha(isSpecial ? 0.55 : 0.35);
            glow.setScale(isSpecial ? 1.2 : 1);
        }
        
        if (border) {
            border.setStrokeStyle(isSpecial ? 4 : 3, color ?? 0xffffff, 0.95);
        }
        
        if (body) {
            body.setScale(isSpecial ? 1.05 : 1);
        }
        
        if (isSpecial) {
            const rotationTween = this.tweens.add({
                targets: foodSprite,
                angle: 360,
                duration: 3000,
                repeat: -1,
                ease: 'Linear'
            });
            
            foodSprite.setData('rotationTween', rotationTween);
        } else {
            foodSprite.setAngle(0);
        }
    }
    
    private updateScore() {
        if (!this.gameState || !this.playerId) return;
        
        const player = this.gameState.players.get(this.playerId);
        if (player) {
            this.scoreText.setText(`Score: ${player.score}`);
            if (this.roomType === 'vip') {
                const creditValue = typeof player.credit === 'number'
                    ? player.credit
                    : this.vipCredit;
                this.updateVipCreditDisplay(creditValue);
            }
        }
    }

    private updateVipCreditDisplay(credit: number): void {
        this.vipCredit = credit;
        if (this.vipCreditText) {
            this.vipCreditText.setText(`Credit: ${this.formatCredit(credit)}`);
        }
    }

    private updateVipInfoText(): void {
        if (!this.vipInfoText) {
            return;
        }

        if (!this.vipConfig) {
            this.vipInfoText.setText('');
            return;
        }

        const entryFee = this.formatCredit(this.vipConfig.entryFee);
        const reward = this.formatCredit(this.vipConfig.rewardRatePlayer);
        const fee = this.formatCredit(this.vipConfig.rewardRateTreasury);

        this.vipInfoText.setText(`Entry ${entryFee} • Reward ${reward} • Fee ${fee}`);
    }

    private normalizeVipConfig(raw: any): VipRoomConfig {
        return {
            entryFee: this.toNumber(raw?.entryFee ?? this.vipConfig?.entryFee),
            rewardRatePlayer: this.toNumber(raw?.rewardRatePlayer ?? this.vipConfig?.rewardRatePlayer),
            rewardRateTreasury: this.toNumber(raw?.rewardRateTreasury ?? this.vipConfig?.rewardRateTreasury),
            respawnCost: this.toNumber(raw?.respawnCost ?? this.vipConfig?.respawnCost),
            maxClients: Number.isFinite(raw?.maxClients) ? raw.maxClients : this.vipConfig?.maxClients ?? 20,
            tickRate: Number.isFinite(raw?.tickRate) ? raw.tickRate : this.vipConfig?.tickRate ?? 60,
            metadata: raw?.metadata ?? this.vipConfig?.metadata ?? {},
        };
    }

    private handleVipReward(message: any): void {
        if (!message) {
            return;
        }

        const rewardAmount = this.formatCredit(this.toNumber(message.rewardAmount));

        if (message.killerId === this.playerId) {
            this.showVipNotification(`+${rewardAmount} credit reward`, 0x66ff99);
        } else if (message.victimId === this.playerId) {
            this.showVipNotification(`-${rewardAmount} credit penalty`, 0xff6666);
        }
    }

    private showVipNotification(text: string, tint: number = 0xffd700): void {
        if (!text) {
            return;
        }

        const notification = this.add.text(
            this.cameras.main.centerX,
            70,
            text,
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                fontStyle: 'bold',
                color: this.toHexColor(tint),
                stroke: '#000000',
                strokeThickness: 3,
            },
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(250);

        this.tweens.add({
            targets: notification,
            alpha: 0,
            duration: 400,
            delay: 1600,
            onComplete: () => notification.destroy(),
        });
    }

    private formatCredit(value: number): string {
        if (!Number.isFinite(value)) {
            return '0';
        }

        if (value === 0) {
            return '0';
        }

        if (value >= 1) {
            return value.toFixed(2).replace(/\.?0+$/, '');
        }

        return value.toFixed(3).replace(/\.?0+$/, '');
    }

    private toNumber(value: unknown): number {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }

    private toHexColor(value: number): string {
        const color = Phaser.Display.Color.IntegerToColor(value);
        return `#${color.color.toString(16).padStart(6, '0')}`;
    }
    
    private updateLeaderboard() {
        const room = this.room;
        const playersMap = room?.state?.players;
        if (!room || !playersMap) return;
        
        // Clear existing leaderboard entries
        if (this.leaderboardPanel) {
            this.leaderboardPanel.removeAll(true);
        } else {
            // Create leaderboard panel if it doesn't exist
            this.leaderboardPanel = this.add.container(this.cameras.main.width - 130, 10);
            this.leaderboardPanel.setScrollFactor(0);
            this.leaderboardPanel.setDepth(100);
        }
        
        // Add background with gradient and rounded corners
        const bgWidth = 240;
        const bgHeight = 300;
        const bg = this.add.graphics();
        bg.fillGradientStyle(
            0x0d2828, 0x0d2828,  // Dark teal at top
            0x081818, 0x081818,  // Darker teal at bottom
            1, 1, 1, 1
        );
        bg.fillRoundedRect(-bgWidth/2, 0, bgWidth, bgHeight, 10);
        bg.lineStyle(2, 0x2d7a7a, 0.8);
        bg.strokeRoundedRect(-bgWidth/2, 0, bgWidth, bgHeight, 10);
        this.leaderboardPanel.add(bg);
        
        // Add title with icon
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x1a5555, 0.8);
        titleBg.fillRoundedRect(-bgWidth/2, 0, bgWidth, 40, { tl: 10, tr: 10, bl: 0, br: 0 });
        this.leaderboardPanel.add(titleBg);
        
        const title = this.add.text(0, 20, 'LEADERBOARD', { 
            fontFamily: 'Arial', 
            fontSize: '20px', 
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        
        this.leaderboardPanel.add(title);
        
        // Add column headers
        const headerY = 50;
        const rankHeader = this.add.text(-bgWidth/2 + 20, headerY, 'RANK', { 
            fontFamily: 'Arial', 
            fontSize: '12px',
            color: '#aaaaff',
            fontStyle: 'bold'
        });
        
        const nameHeader = this.add.text(-bgWidth/2 + 60, headerY, 'NAME', { 
            fontFamily: 'Arial', 
            fontSize: '12px',
            color: '#aaaaff',
            fontStyle: 'bold'
        });
        
        const scoreHeader = this.add.text(-bgWidth/2 + 140, headerY, 'SCORE', { 
            fontFamily: 'Arial', 
            fontSize: '12px',
            color: '#aaaaff',
            fontStyle: 'bold'
        });
        
        const killsHeader = this.add.text(-bgWidth/2 + 190, headerY, 'KILLS', { 
            fontFamily: 'Arial', 
            fontSize: '12px',
            color: '#aaaaff',
            fontStyle: 'bold'
        });
        
        this.leaderboardPanel.add(rankHeader);
        this.leaderboardPanel.add(nameHeader);
        this.leaderboardPanel.add(scoreHeader);
        this.leaderboardPanel.add(killsHeader);
        
        // Add separator line
        const separator = this.add.graphics();
        separator.lineStyle(1, 0x2d7a7a, 0.5);
        separator.lineBetween(-bgWidth/2 + 10, headerY + 15, bgWidth/2 - 10, headerY + 15);
        this.leaderboardPanel.add(separator);
        
        // Get players and sort by score
        const players: any[] = [];
        playersMap.forEach((player: Player, sessionId: string) => {
            players.push({
                id: sessionId,
                name: player.name,
                score: player.score,
                kills: player.kills || 0,
                color: player.color
            });
        });
        
        players.sort((a, b) => b.score - a.score);
        
        // Add player entries
        const topPlayers = players.slice(0, 10); // Show top 10 players
        topPlayers.forEach((player, index) => {
            const isCurrentPlayer = player.id === this.playerId;
            const rowY = 75 + (index * 22);
            
            // Add row background for current player
            if (isCurrentPlayer) {
                const rowBg = this.add.graphics();
                rowBg.fillStyle(0x1a5555, 0.5);
                rowBg.fillRoundedRect(-bgWidth/2 + 10, rowY - 10, bgWidth - 20, 20, 5);
                this.leaderboardPanel.add(rowBg);
            }
            
            // Rank with medal for top 3
            let rankText = `${index + 1}`;
            let rankColor = '#ffffff';
            
            if (index === 0) {
                rankText = '🥇';
                rankColor = '#ffd700'; // Gold
            } else if (index === 1) {
                rankText = '🥈';
                rankColor = '#c0c0c0'; // Silver
            } else if (index === 2) {
                rankText = '🥉';
                rankColor = '#cd7f32'; // Bronze
            }
            
            const rank = this.add.text(-bgWidth/2 + 20, rowY, rankText, { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: rankColor,
                fontStyle: isCurrentPlayer ? 'bold' : 'normal'
            }).setOrigin(0, 0.5);
            
            // Player name with color indicator
            const nameColor = isCurrentPlayer ? '#ffff00' : '#ffffff';
            const nameText = player.name.length > 10 ? player.name.substr(0, 8) + '..' : player.name;
            
            // Color indicator circle
            const colorCircle = this.add.graphics();
            colorCircle.fillStyle(parseInt(player.color.replace('#', '0x')), 1);
            colorCircle.fillCircle(-bgWidth/2 + 55, rowY, 4);
            
            const name = this.add.text(-bgWidth/2 + 65, rowY, nameText, { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: nameColor,
                fontStyle: isCurrentPlayer ? 'bold' : 'normal'
            }).setOrigin(0, 0.5);
            
            // Score
            const score = this.add.text(-bgWidth/2 + 140, rowY, `${player.score}`, { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: nameColor,
                fontStyle: isCurrentPlayer ? 'bold' : 'normal'
            }).setOrigin(0, 0.5);
            
            // Kills with skull icon
            const kills = this.add.text(-bgWidth/2 + 190, rowY, `${player.kills}`, { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: nameColor,
                fontStyle: isCurrentPlayer ? 'bold' : 'normal'
            }).setOrigin(0, 0.5);
            
            this.leaderboardPanel.add(rank);
            this.leaderboardPanel.add(colorCircle);
            this.leaderboardPanel.add(name);
            this.leaderboardPanel.add(score);
            this.leaderboardPanel.add(kills);
        });
        
        // Update player's rank
        const currentPlayerIndex = players.findIndex(p => p.id === this.playerId);
        if (currentPlayerIndex !== -1) {
            if (this.playerRankText) {
                this.playerRankText.setText(`Rank: ${currentPlayerIndex + 1}/${players.length}`);
            }
        }
    }
    
    private updateMinimap() {
        if (!this.gameState) return;
        
        // Clear the minimap
        this.minimap.clear();
        
        // Draw the world border
        this.minimap.lineStyle(1, 0xFFFFFF, 0.5);
        this.minimap.strokeRect(0, 0, 150, 150);
        
        // Calculate scale factors
        const scaleX = 150 / this.worldWidth;
        const scaleY = 150 / this.worldHeight;
        
        // Draw all players
        this.gameState.players.forEach((player: any) => {
            if (!player.alive || !player.headPosition) return;
            
            // Use headPosition instead of segments[0]
            const headPosition = player.headPosition;
            
            // Calculate minimap position
            const minimapX = headPosition.x * scaleX;
            const minimapY = headPosition.y * scaleY;
            
            // Draw player dot
            const isCurrentPlayer = player.id === this.playerId;
            const color = isCurrentPlayer ? 0xFFFF00 : 0xFFFFFF;
            const size = isCurrentPlayer ? 4 : 2;
            
            this.minimap.fillStyle(color, 1);
            this.minimap.fillCircle(minimapX, minimapY, size);
        });
        
        // Draw food dots (smaller and with different color)
        this.foods.forEach((food) => {
            const minimapX = food.x * scaleX;
            const minimapY = food.y * scaleY;
            
            // Use different colors for different food values
            const isSpecialFood = food.getData('value') > 1;
            const foodColor = isSpecialFood ? 0xFF00FF : 0x00FF00;
            
            this.minimap.fillStyle(foodColor, 0.7);
            this.minimap.fillCircle(minimapX, minimapY, 1);
        });
    }
    
    private handlePlayerDeath() {
        console.log('Player died!');
        
        // Make sure deathOverlay exists before trying to use it
        if (!this.deathOverlay) {
            this.createDeathOverlay();
        }
        
        // Show death overlay
        this.showDeathOverlay();
    }
    
    private showDeathOverlay() {
        // Make sure deathOverlay exists before trying to use it
        if (!this.deathOverlay) {
            this.createDeathOverlay();
        }
        
        this.deathOverlay.setVisible(true);
        
        // Also show the buttons
        if (this.respawnButton) this.respawnButton.setVisible(true);
        if (this.menuButton) this.menuButton.setVisible(true);
        
        // Update score on death screen
        const player = this.gameState.players.get(this.playerId);
        if (player) {
            // Find the score text in the death overlay container
            const scoreText = this.deathOverlay.getByName('scoreText');
            if (scoreText && scoreText instanceof Phaser.GameObjects.Text) {
                scoreText.setText(`Score: ${player.score}`);
            } else {
                // If scoreText doesn't exist or isn't properly set up, create a new one
                const width = this.cameras.main.width;
                const height = this.cameras.main.height;
                
                const newScoreText = this.add.text(width/2, height/2, `Score: ${player.score}`, {
                    fontFamily: 'Arial',
                    fontSize: '32px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4
                }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
                
                newScoreText.setName('scoreText');
                this.deathOverlay.add(newScoreText);
            }
        }
    }
    
    private updateCamera() {
        if (!this.gameState || !this.playerId) return;
        
        const player = this.gameState.players.get(this.playerId);
        if (player && player.alive && player.headPosition) {
            // Set target camera position to player's head
            this.targetCameraX = player.headPosition.x;
            this.targetCameraY = player.headPosition.y;
            
            // Get current camera position
            const currentX = this.cameras.main.scrollX + this.cameras.main.width / 2;
            const currentY = this.cameras.main.scrollY + this.cameras.main.height / 2;
            
            // Calculate interpolated position
            const newX = currentX + (this.targetCameraX - currentX) * this.cameraLerpFactor;
            const newY = currentY + (this.targetCameraY - currentY) * this.cameraLerpFactor;
            
            // Center camera on interpolated position
            this.cameras.main.centerOn(newX, newY);
        }
    }
    
    // Update the player text position with interpolation
    private updatePlayerTexts() {
        if (!this.gameState) return;
        
        this.playerTexts.forEach((text, playerId) => {
            const player = this.gameState.players.get(playerId);
            if (player && player.alive) {
                // Use headPosition instead of segments[0]
                const headPosition = player.headPosition;
                if (headPosition) {
                    // Apply smoother interpolation for text
                    const lerpFactor = 0.2;
                    
                    // Get current position
                    const currentX = text.x;
                    const currentY = text.y;
                    
                    // Target position (above the head)
                    const targetX = headPosition.x;
                    const targetY = headPosition.y - 40;
                    
                    // Calculate interpolated position
                    const newX = currentX + (targetX - currentX) * lerpFactor;
                    const newY = currentY + (targetY - currentY) * lerpFactor;
                    
                    // Update position
                    text.setPosition(newX, newY);
                    
                    // Scale text based on player score - similar to snake scaling
                    const baseScale = Math.min(1.5, 1 + (player.score / 100));
                    text.setScale(baseScale);
                }
            }
        });
    }
    
    private setupAudio() {
        // Set up sound effects
        this.eatSound = this.sound.add('eat');
        this.deathSound = this.sound.add('death');
        this.boostSound = this.sound.add('boost');
        
        // Set up background music with loop
        this.backgroundMusic = this.sound.add('background', {
            volume: 0.3,
            loop: true
        });
        
        // Start playing background music
        this.backgroundMusic.play();
    }
    
    private toggleMusic() {
        if (this.backgroundMusic.isPlaying) {
            this.backgroundMusic.pause();
        } else {
            this.backgroundMusic.resume();
        }
    }
    
    // Clean up method called when scene is destroyed
    cleanUp() {
        // Stop background music when leaving the scene
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Clean up resources
        if (this.room) {
            this.room.removeAllListeners();
        }
    }
    
    // Update the attractFoodInFront method to handle glow cleanup when food is eaten
    private attractFoodInFront(headX: number, headY: number, angleDeg: number) {
        if (!this.gameState || !this.foods) return;
        
        const player = this.gameState.players.get(this.playerId);
        if (!player || !player.alive) return;
        
        // Convert angle to radians
        const angleRad = Phaser.Math.DegToRad(angleDeg);
        
        // Define the attraction parameters
        const attractionDistance = 200; // Tăng khoảng cách hút lên
        const attractionConeAngle = Math.PI / 2.5; // Mở rộng góc hút (khoảng 72 độ)
        const attractionStrength = 5; // Tăng lực hút lên đáng kể
        const eatDistance = 30; // Khoảng cách để tự động ăn thức ăn
        
        // Check each food item
        this.foods.forEach((foodSprite, foodId) => {
            // Calculate distance and angle to food
            const dx = foodSprite.x - headX;
            const dy = foodSprite.y - headY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Skip if too far away
            if (distance > attractionDistance) return;
            
            // Calculate angle to food
            const foodAngle = Math.atan2(dy, dx);
            
            // Calculate angle difference (accounting for wrapping)
            let angleDiff = Math.abs(foodAngle - angleRad);
            if (angleDiff > Math.PI) {
                angleDiff = 2 * Math.PI - angleDiff;
            }
            
            // Check if food is within the attraction cone
            if (angleDiff <= attractionConeAngle / 2) {
                // Calculate attraction force (stronger when closer and more aligned)
                const alignmentFactor = 1 - (angleDiff / (attractionConeAngle / 2));
                const distanceFactor = 1 - (distance / attractionDistance);
                const attractionForce = attractionStrength * alignmentFactor * distanceFactor;
                
                // Calculate movement vector toward the snake head
                const moveX = (headX - foodSprite.x) * attractionForce * 0.1; // Tăng hệ số lên gấp đôi
                const moveY = (headY - foodSprite.y) * attractionForce * 0.1; // Tăng hệ số lên gấp đôi
                
                // Apply movement (only visually on the client side)
                foodSprite.x += moveX;
                foodSprite.y += moveY;
                
                // Check if food is close enough to be eaten
                const newDistance = Phaser.Math.Distance.Between(headX, headY, foodSprite.x, foodSprite.y);
                if (newDistance < eatDistance) {
                    // Get and destroy glow if it exists before hiding the food
                    const glow = foodSprite.getData('glow');
                    if (glow) {
                        glow.destroy();
                        foodSprite.setData('glow', null);
                    }
                    
                    // Visually "eat" the food immediately
                    foodSprite.setVisible(false);
                    foodSprite.setScale(0);
                    
                    // Play eat sound
                    this.eatSound.play({ volume: 0.5 });
                    
                    // Add a visual effect at the position
                    this.addEatEffect(foodSprite.x, foodSprite.y, foodSprite.getData('value') || 1);
                    
                    // Send message to server that food was eaten, including current positions
                    console.log(`Sending eatFood message for food ${foodId}, distance: ${newDistance}`);
                    const room = this.room;
                    if (room && !this.isQuitting) {
                        room.send('eatFood', { 
                            foodId: foodId,
                            headX: headX,
                            headY: headY,
                            foodX: foodSprite.x,
                            foodY: foodSprite.y
                        });
                    }
                }
                
                // Add a subtle visual effect to show attraction
                if (!foodSprite.data || !foodSprite.data.get('isAttracting')) {
                    foodSprite.setData('isAttracting', true);
                    
                    // Add a more noticeable pulsing effect
                    this.tweens.add({
                        targets: foodSprite,
                        alpha: { from: 1, to: 0.7 },
                        scale: { from: 1, to: 1.5 }, // Tăng hiệu ứng phóng to
                        duration: 200, // Giảm thời gian để hiệu ứng nhanh hơn
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            } else {
                // Reset visual effect if food is no longer being attracted
                if (foodSprite.data && foodSprite.data.get('isAttracting')) {
                    foodSprite.setData('isAttracting', false);
                    
                    // Stop any existing tweens
                    this.tweens.killTweensOf(foodSprite);
                    
                    // Reset to normal appearance
                    foodSprite.setAlpha(1);
                    foodSprite.setScale(1);
                    
                    // Restart the normal scale animation
                    this.tweens.add({
                        targets: foodSprite,
                        scale: { from: 0.8, to: 1.2 },
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
        });
    }
    
    // Update the addEatEffect method to show different values for special food
    private addEatEffect(x: number, y: number, value: number = 1) {
        // Create a flash effect
        const flash = this.add.circle(x, y, 30, value > 1 ? 0xffff00 : 0xffffff, 0.7);
        flash.setDepth(30);
        
        // Add fade out and scale up effect
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                flash.destroy();
            }
        });
        
        // Create particle burst effect
        const particles = this.add.particles(x, y, value > 1 ? 'special-food' : 'food', {
            speed: { min: 50, max: 200 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            quantity: value > 1 ? 15 : 10,
            blendMode: 'ADD',
            emitting: false
        });
        
        // Emit particles once
        particles.explode(value > 1 ? 15 : 10);
        
        // Auto-destroy after animation completes
        this.time.delayedCall(500, () => {
            particles.destroy();
        });
        
        // Add a score popup text
        const scoreText = this.add.text(x, y - 20, `+${value}`, {
            fontFamily: 'Arial',
            fontSize: value > 1 ? '24px' : '20px',
            color: value > 1 ? '#ffff00' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
        
        // Animate the score text
        this.tweens.add({
            targets: scoreText,
            y: y - 60,
            alpha: 0,
            scale: 1.5,
            duration: 800,
            ease: 'Power2',
            onComplete: () => {
                scoreText.destroy();
            }
        });
    }
    
    // Modify the onRoomStateChange handler to update segment count
    private onRoomStateChange() {
        // ... existing code ...
        
        // When the player's snake changes length, update the segments
        const room = this.room;
        const players = room?.state?.players;
        if (!room || !players) {
            return;
        }

        players.onAdd = (player: any, key: string) => {
            console.log(`Player added: ${key}`);
            
            // Listen for changes to the player's score to update segment count
            player.listen("score", (newScore: number, oldScore: number) => {
                if (key === this.playerId) {
                    // Update segment count based on score changes
                    const currentSnake = this.snakes.get(key);
                    if (currentSnake) {
                        const currentSegmentCount = currentSnake.getLength();
                        const targetSegmentCount = 5 + Math.floor(newScore); // Base segments + score
                        
                        // Add segments if needed
                        if (targetSegmentCount > currentSegmentCount) {
                            for (let i = currentSegmentCount; i < targetSegmentCount; i++) {
                                // Create new segment
                                const newSegment = this.add.image(0, 0, 'snakeBody');
                                newSegment.setDepth(10);
                                currentSnake.add(newSegment);
                            }
                        }
                        // Remove segments if needed (e.g., when boosting)
                        else if (targetSegmentCount < currentSegmentCount) {
                            const children = currentSnake.getChildren();
                            for (let i = targetSegmentCount; i < children.length; i++) {
                                children[i].destroy();
                            }
                        }
                    }
                }
            });
            
            // ... rest of existing code ...
        };
    }
    
    // Update the showKillNotification method with improved visuals
    private showKillNotification(killerSessionId: string, killedSessionId: string) {
        console.log(`showKillNotification called with killer: ${killerSessionId}, killed: ${killedSessionId}`);
        
        // Get player names or use session IDs if names aren't available
        const killerName = this.getPlayerName(killerSessionId) || `Player ${killerSessionId.substr(0, 4)}`;
        const killedName = this.getPlayerName(killedSessionId) || `Player ${killedSessionId.substr(0, 4)}`;
        
        console.log(`Notification text: ${killerName} eliminated ${killedName}!`);
        
        // Create container for the notification
        const container = this.add.container(
            this.cameras.main.width / 2,
            80 + (this.killNotifications.length * 40)
        ).setScrollFactor(0).setDepth(1000);
        
        // Add background with gradient
        const bgWidth = 400;
        const bgHeight = 50;
        const background = this.add.graphics();
        background.fillGradientStyle(
            0x990000, 0x990000,  // Red gradient at top
            0x330000, 0x330000,  // Darker red at bottom
            1, 1, 1, 1
        );
        background.fillRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, 10);
        background.lineStyle(2, 0xff0000, 1);
        background.strokeRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, 10);
        container.add(background);
        
        // Add skull icon
        const skull = this.add.image(-bgWidth/2 + 30, 0, 'food')  // Replace with skull icon if available
            .setTint(0xff0000)
            .setScale(1.5);
        container.add(skull);
        
        // Add text with killer name in bold - enable HTML formatting
        const notificationText = this.add.text(
            -bgWidth/2 + 60, 0,
            '', // Start with empty text, we'll set it with HTML below
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }
        ).setOrigin(0, 0.5);
        
        // Enable HTML formatting
        notificationText.setStyle({ fontStyle: 'bold' });
        
        // Since HTML might not work reliably, let's use a different approach
        // Make the killer name a different color instead of bold
        const killText = `${killerName} eliminated ${killedName}!`;
        notificationText.setText(killText);
        
        // Create a separate text object for the killer name with different styling
        const killerText = this.add.text(
            -bgWidth/2 + 60, 0,
            killerName,
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffff00', // Yellow color for emphasis
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0.5);
        
        // Calculate the width of the killer name to position the rest of the text
        const killerWidth = killerText.width;
        
        // Create the "eliminated" text
        const eliminatedText = this.add.text(
            -bgWidth/2 + 60 + killerWidth + 5, 0,
            `eliminated ${killedName}!`,
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0, 0.5);
        
        // Remove the original text and add the new text components
        notificationText.destroy();
        container.add(killerText);
        container.add(eliminatedText);
        
        // Add to notifications array
        this.killNotifications.push(container);
        
        // Add entrance animation
        container.setAlpha(0);
        container.y -= 20;
        
        this.tweens.add({
            targets: container,
            y: '+=20',
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
        
        // Add subtle pulse animation
        this.tweens.add({
            targets: skull,
            scale: 1.8,
            duration: 300,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });
        
        // Add sound effect for kill notification
        if (this.deathSound) {
            this.deathSound.play({ volume: 0.3 });
        }
        
        // Remove notification after a few seconds
        this.time.delayedCall(3500, () => {
            // Exit animation
            this.tweens.add({
                targets: container,
                y: '-=20',
                alpha: 0,
                duration: 300,
                ease: 'Back.easeIn',
                onComplete: () => {
                    container.destroy();
                    this.killNotifications = this.killNotifications.filter(n => n !== container);
                    
                    // Move remaining notifications up
                    this.killNotifications.forEach((notification, index) => {
                        this.tweens.add({
                            targets: notification,
                            y: 80 + (index * 40),
                            duration: 200,
                            ease: 'Quad.easeOut'
                        });
                    });
                }
            });
        });
    }
    
    // Update the getPlayerName helper method to handle undefined cases
    private getPlayerName(sessionId: string): string | null {
        const room = this.room;
        const players = room?.state?.players;
        if (!room || !players) {
            return null;
        }
        const player = players.get(sessionId);
        return player && player.name ? player.name : null;
    }
    
    // Add this method to check for collisions between players
    private checkPlayerCollisions() {
        // ... entire method to be removed ...
    }
    
    // Add the respawn method to handle respawn button clicks
    private respawn() {
        console.log('Respawning player...');
        
        // Hide death overlay and buttons
        if (this.deathOverlay) this.deathOverlay.setVisible(false);
        if (this.respawnButton) this.respawnButton.setVisible(false);
        if (this.menuButton) this.menuButton.setVisible(false);
        
        // Set invulnerability for 3 seconds
        this.invulnerableUntil = this.time.now + 3000;
        console.log('Player is invulnerable until:', this.invulnerableUntil);
        
        // Send respawn message to server
        const room = this.room;
        if (room && !this.isQuitting) {
            room.send('respawn');
            console.log('Sent respawn message to server');
        }
    }

    private async leaveRoomSafely(): Promise<void> {
        const room = this.room;
        if (!room) {
            return;
        }

        this.room = null;
        try {
            await room.leave(true);
            room.removeAllListeners();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

            if (message?.includes('WebSocket is already in CLOSING or CLOSED state')) {
                console.warn('Room leave requested while socket closing. Treating as already disconnected.');
                room.removeAllListeners();
                return;
            }

            this.room = room;
            throw error;
        }
    }
    
    private createQuitButton(x: number, y: number) {
        const btnWidth = 100;
        const btnHeight = 50;
        
        // Create button background
        const buttonBg = this.add.rectangle(x, y, btnWidth, btnHeight, 0xff4c4c, 0.8)
            .setOrigin(0, 0)
            .setDepth(1000)
            .setScrollFactor(0)
            .setStrokeStyle(2, 0xffffff, 0.8)
            .setInteractive({ useHandCursor: true });
        
        // Create button text - positioned at center of button
        const buttonText = this.add.text(x + btnWidth/2, y + btnHeight/2, '⏻ Quit', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        })
            .setOrigin(0.5, 0.5)
            .setDepth(1001)
            .setScrollFactor(0);
 
        // Hover effect
        buttonBg.on('pointerover', () => {
            this.tweens.add({
                targets: [buttonBg, buttonText],
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 200,
                ease: 'Back.easeOut'
            });
        });
        
        buttonBg.on('pointerout', () => {
            this.tweens.add({
                targets: [buttonBg, buttonText],
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Back.easeIn'
            });
        });
        
        // Click handler
        buttonBg.on('pointerdown', () => {
            this.handleQuitClick(buttonBg, buttonText);
        });
        
        // Make text also interactive and forward events to buttonBg
        buttonText.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.handleQuitClick(buttonBg, buttonText);
            })
            .on('pointerover', () => buttonBg.emit('pointerover'))
            .on('pointerout', () => buttonBg.emit('pointerout'));
    }
    
    private handleQuitClick(buttonBg: Phaser.GameObjects.Rectangle, buttonText: Phaser.GameObjects.Text) {
        if (this.isQuitting) {
            return;
        }

        buttonBg.disableInteractive();
        buttonText.disableInteractive();

        this.tweens.add({
            targets: buttonBg,
            fillAlpha: 0.7,
            duration: 100,
            yoyo: true,
            onComplete: async () => {
                if (this.isQuitting) {
                    return;
                }

                try {
                    this.isQuitting = true;
                    buttonText.setText('Leaving...');
                    await this.leaveRoomSafely();
                    console.log('Left the game room');
                    
                    // Emit event to return to React menu
                    EventBus.emit('game-exit');
                } catch (error) {
                    console.error('Error leaving room:', error);
                    this.isQuitting = false;
                    buttonText.setText('Retry?');
                    buttonBg.setInteractive();
                    buttonText.setInteractive({ useHandCursor: true });
                }
            }
        });
    }
} 