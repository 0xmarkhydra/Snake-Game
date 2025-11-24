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
    private snakeEyes: Map<string, Phaser.GameObjects.Graphics> = new Map(); // Eyes overlay for each snake
    private foods: Map<string, Phaser.GameObjects.Image> = new Map();
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
    private cameraLerpFactor: number = 0.16; // Base smoothing factor
    private cameraLerpMax: number = 0.35; // Hard cap when forcing catch-up
    private cameraCatchupDistance: number = 220; // Distance before forcing faster camera
    private cameraCatchupBoost: number = 0.4; // Additional lerp factor applied when distance is large
    
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
    
    // 🚀 PERFORMANCE: Throttle update counters
    // Note: Player text position now updates directly with snake head, no throttling needed
    
    // 🚀 PERFORMANCE: Leaderboard change detection
    private lastLeaderboardHash: string = '';
    private leaderboardUpdateCounter: number = 0;
    private leaderboardUpdateInterval: number = 10; // Check every 10 frames (~166ms at 60fps)
    
    // 🚀 PERFORMANCE: Minimap update throttling
    private minimapUpdateCounter: number = 0;
    private minimapUpdateInterval: number = 3; // Update every 3 frames (~50ms at 60fps)
    
    // 🚀 PERFORMANCE: Camera update throttling
    private cameraUpdateCounter: number = 0;
    private cameraUpdateInterval: number = 1; // Update every frame (can be increased if needed)
    
    // 🚀 PERFORMANCE: Adaptive quality based on FPS
    private currentFPS: number = 60;
    private fpsCheckCounter: number = 0;
    private fpsCheckInterval: number = 30; // Check every 30 frames (0.5s at 60fps)
    private adaptiveQualityEnabled: boolean = true;
    
    // Add these properties to the class
    private segmentSpacing: number = 16; // Center-to-center distance to keep segments touching
    private playerSegmentHistories: Map<string, Array<{ x: number; y: number }>> = new Map(); // Store histories for all players
    private historySize: number = 1500; // Maximum history size
    private readonly baseSnakeSegments: number = 5;
    private readonly baseSnakeRadius: number = 18;
    private readonly radiusGrowthBaseThreshold: number = 10;
    private readonly radiusGrowthThresholdIncrement: number = 5;
    private readonly radiusGrowthPerLevel: number = 0.05;
    private readonly maxSnakeScale: number = 1.5;
    
    // Add this new property
    private killNotifications: Phaser.GameObjects.Container[] = [];
    
    // Add this new property
    private statsPanel: Phaser.GameObjects.Container;
    
    // Add this property to the class
    private lastAngle: number = 0;
    private maxAngleChange: number = 16; // Increased for better turn responsiveness
    
    // 🚀 PERFORMANCE: Throttle network messages
    private lastSentAngle: number = 0;
    private lastMoveSentTime: number = 0;
    private moveSendInterval: number = 30; // Allow up to ~33 sends/sec
    private minAngleDiffToSend: number = 0.4; // Send sooner on small adjustments
    private boostMoveSendIntervalFactor: number = 0.5; // Faster send cadence while boosting
    private rapidTurnAngleThreshold: number = 6; // Immediately send if angle delta exceeds this
    
    // 🔥 PERFORMANCE: Throttle food attraction calculation
    private lastAttractionUpdate: number = 0;
    private attractionUpdateInterval: number = 33; // Update every 33ms (~30 times per second) - balanced for smooth attraction
    
    // Add this property to the GameScene class
    private invulnerableUntil: number = 0;
    private headAttractionAura?: Phaser.GameObjects.Graphics;
    private headAuraRadius: number = 120;
    
    // Render smoothing
    private playerRenderPositions: Map<string, { x: number; y: number }> = new Map();
    private readonly headLerpScale: number = 0.35;
    private readonly headLerpMin: number = 0.2;
    private readonly headLerpMax: number = 0.65;
    private readonly headLerpBoostedMax: number = 0.85;
    private readonly headCatchupDistance: number = 160;
    private readonly headCatchupMaxBoost: number = 0.8;
    
    // Blink effect for snake eyes
    private blinkTimers: Map<string, number> = new Map(); // Timer for each snake
    private isBlinking: Map<string, boolean> = new Map(); // Blink state for each snake
    
    // 🚀 PERFORMANCE: Cache eyes graphics state to avoid redrawing every frame
    private lastEyesAngle: Map<string, number> = new Map();
    private lastEyesBoosting: Map<string, boolean> = new Map();
    private lastEyesBlinking: Map<string, boolean> = new Map();
    private lastEyesRadius: Map<string, number> = new Map();
    
    // 🚀 PERFORMANCE: Batch segment updates - only update portion each frame (smaller values mean lighter frames)
    private segmentUpdateBatchSize: number = 10;
    private segmentUpdateFrameCounter: number = 0;
    
    // 🚀 PERFORMANCE: Low-end device optimizations
    private enableVisualEffects: boolean = true; // Enable/disable visual effects based on FPS
    private enableParticleEffects: boolean = true; // Enable/disable particle effects
    private enableFoodAnimations: boolean = true; // Enable/disable food animations
    private enableAttractionAura: boolean = true; // Enable/disable attraction aura
    
    // Leaderboard cached objects for performance
    private leaderboardEntries: Map<number, {
        rankText: Phaser.GameObjects.Text,
        colorCircle: Phaser.GameObjects.Graphics,
        nameText: Phaser.GameObjects.Text,
        scoreText: Phaser.GameObjects.Text,
        killsText: Phaser.GameObjects.Text,
        rowBg?: Phaser.GameObjects.Graphics
    }> = new Map();
    private leaderboardBackground: Phaser.GameObjects.Graphics;
    private leaderboardTitle: Phaser.GameObjects.Text;
    private leaderboardHeaders: {
        rank: Phaser.GameObjects.Text,
        name: Phaser.GameObjects.Text,
        score: Phaser.GameObjects.Text,
        kills: Phaser.GameObjects.Text
    };

    // Food color palette
    private readonly foodColorPalette: number[] = [
        0x2ecc71, // green
        0xf1c40f, // yellow
        0x9b59b6, // purple
        0xe74c3c, // red
        0xff8c00  // orange
    ];
    private foodTextureKeys: Map<number, string> = new Map();
    
    // 🚀 PERFORMANCE: Texture caching for snake segments
    private segmentTextureCache: Map<string, string> = new Map(); // color -> textureKey
    private eyeTextureCache: Map<string, string> = new Map(); // state -> textureKey
    
    // 🚀 PERFORMANCE: Adaptive rendering thresholds
    private readonly SEGMENT_COUNT_LOW = 50; // Full quality
    private readonly SEGMENT_COUNT_MEDIUM = 100; // Medium quality
    private readonly SEGMENT_COUNT_HIGH = 150; // Low quality
    
    // 🚀 PERFORMANCE: Viewport culling - optimized buffer size
    private viewportBuffer: number = 100; // Reduced from 150 to 100 for better performance
    private cameraMoveThreshold: number = 50; // Only recalculate viewport when camera moves significantly
    
    // Wall warning system
    private wallWarningGraphics: Phaser.GameObjects.Graphics;
    private readonly wallWarningDistance: number = 300; // Distance to start showing warning
    private readonly wallDangerDistance: number = 150; // Distance for strong warning
    private lastWallWarningUpdate: number = 0;
    private wallWarningUpdateInterval: number = 16; // Update every ~16ms (60fps)
    
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
    
    // Helper method to create sharp text with high resolution
    private createSharpText(x: number, y: number, text: string, style?: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
        const textObj = this.add.text(x, y, text, style);
        // Set high resolution for crisp text rendering
        // Import getOptimalDevicePixelRatio at top of file if needed, or use inline calculation
        const resolution = Math.min(window.devicePixelRatio || 1, 2);
        if (textObj.setResolution) {
            textObj.setResolution(resolution);
        }
        return textObj;
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
        this.ensureFoodTextures();
        
        // Set up input
        this.pointer = this.input.activePointer;
        
        // Set up UI
        this.createUI();
        
        // Create wall warning graphics
        this.wallWarningGraphics = this.add.graphics();
        this.wallWarningGraphics.setDepth(200); // Above everything
        this.wallWarningGraphics.setScrollFactor(0); // Fixed to camera

        if (this.roomType === 'vip') {
            this.updateVipCreditDisplay(this.vipCredit);
        }
        
        // Create death overlay early to ensure it's ready
        this.createDeathOverlay();
        
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
            this.currentFPS = Math.round(this.game.loop.actualFps);
            this.fpsText.setText(`FPS: ${this.currentFPS}`);
            this.fpsUpdateTime = time;
            
            // 🚀 PERFORMANCE: Adaptive FPS target for low-end devices
            this.adaptFPSTarget();
        }
        
        // 🚀 PERFORMANCE: Adaptive quality based on current FPS
        if (this.adaptiveQualityEnabled) {
            this.fpsCheckCounter++;
            if (this.fpsCheckCounter >= this.fpsCheckInterval) {
                this.adaptQualitySettings();
                this.fpsCheckCounter = 0;
            }
        }
        
        // Update game objects every frame for smoother animations
        this.updateSnakes(delta);
        this.updateFoods();
        
        // 🚀 PERFORMANCE: Throttle player texts update to every 2 frames
        // Name text position now updated directly with snake head in updateSnakes()
        // No need for separate updatePlayerTexts() function
        
        // Update wall warning
        if (time - this.lastWallWarningUpdate >= this.wallWarningUpdateInterval) {
            this.updateWallWarning();
            this.lastWallWarningUpdate = time;
        }
        
        // Calculate angle from player's snake head to mouse pointer
        const player = this.gameState.players.get(this.playerId);
        if (player && player.alive) {
            // Use headPosition instead of segments[0]
            const headPosition = player.headPosition;
            if (!headPosition) return;
            const renderPosition = this.playerRenderPositions.get(this.playerId);
            
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
                const effectiveMaxAngleChange = player.boosting ? this.maxAngleChange * 2.0 : this.maxAngleChange;
                
                if (Math.abs(angleDiff) > effectiveMaxAngleChange) {
                    const sign = Math.sign(angleDiff);
                    angleDeg = this.lastAngle + (sign * effectiveMaxAngleChange);
                }
            }
            
            // Update the last angle
            this.lastAngle = angleDeg;
            
            // Send movement input to server
            // 🚀 PERFORMANCE: Throttle network messages - only send if angle changed significantly or enough time passed
            const angleDiff = Math.abs(angleDeg - this.lastSentAngle);
            const timeSinceLastSend = time - this.lastMoveSentTime;
            const intervalBudget = player.boosting
                ? this.moveSendInterval * this.boostMoveSendIntervalFactor
                : this.moveSendInterval;
            const forceSend = angleDiff >= this.rapidTurnAngleThreshold;
            
            if (forceSend || angleDiff > this.minAngleDiffToSend || timeSinceLastSend > intervalBudget) {
                room.send('move', { angle: angleDeg });
                this.lastSentAngle = angleDeg;
                this.lastMoveSentTime = time;
            }
            
            // Update boost effect position if boosting
            if (player.boosting && this.enableParticleEffects) {
                const boostX = renderPosition?.x ?? headPosition.x;
                const boostY = renderPosition?.y ?? headPosition.y;
                this.updateBoostEffect(boostX, boostY, angleDeg);
            } else if (this.boostEffect && this.isBoosting) {
                this.boostEffect.stop();
            }
            
            // 🚀 PERFORMANCE: Only update attraction aura if enabled
            if (this.enableAttractionAura) {
                this.updateHeadAttractionAura(headPosition.x, headPosition.y);
            } else if (this.headAttractionAura) {
                this.headAttractionAura.setVisible(false);
            }

            // 🔥 PERFORMANCE: Throttle food attraction logic - only run every 33ms for balance
            // Reduce frequency when FPS is low, but don't disable completely to preserve gameplay
            const attractionInterval = this.currentFPS < 30 ? this.attractionUpdateInterval * 2 : this.attractionUpdateInterval;
            if (time - this.lastAttractionUpdate > attractionInterval) {
                this.attractFoodInFront(headPosition.x, headPosition.y, angleDeg);
                this.lastAttractionUpdate = time;
            }
        } else if (this.headAttractionAura) {
            this.headAttractionAura.setVisible(false);
        }
        
        // 🚀 PERFORMANCE: Throttle minimap update to every 3 frames
        this.minimapUpdateCounter++;
        if (this.minimapUpdateCounter >= this.minimapUpdateInterval) {
            this.updateMinimap();
            this.minimapUpdateCounter = 0;
        }
        
        // 🚀 PERFORMANCE: Update leaderboard less frequently with change detection
        this.leaderboardUpdateCounter++;
        if (this.leaderboardUpdateCounter >= this.leaderboardUpdateInterval) {
            this.updateLeaderboardOptimized();
            this.leaderboardUpdateCounter = 0;
        }
        
        // 🚀 PERFORMANCE: Throttle camera update
        this.cameraUpdateCounter++;
        if (this.cameraUpdateCounter >= this.cameraUpdateInterval) {
            this.updateCamera();
            this.cameraUpdateCounter = 0;
        }
        
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
    
    // 🚀 PERFORMANCE: Generate and cache segment texture
    private getOrCreateSegmentTexture(color: number, radius: number, quality: 'high' | 'medium' | 'low'): string {
        const textureKey = `segment_${color.toString(16)}_${radius}_${quality}`;
        
        // Return cached texture if exists
        if (this.textures.exists(textureKey)) {
            return textureKey;
        }
        
        // Determine quality settings
        const gradientSteps = quality === 'high' ? 12 : quality === 'medium' ? 6 : 3;
        const glowSteps = quality === 'high' ? 4 : quality === 'medium' ? 2 : 0;
        
        // Create texture
        const size = Math.ceil(radius * 3); // Texture size
        const rt = this.add.renderTexture(0, 0, size, size).setVisible(false);
        const graphics = this.add.graphics();
        
        const centerX = size / 2;
        const centerY = size / 2;
        
        // Draw shadow
        graphics.fillStyle(0x000000, 0.18);
        graphics.fillCircle(centerX + 2, centerY + 3, radius * 1.05);
        
        // Draw outer glow (only for high/medium quality)
        if (glowSteps > 0) {
            const outerGlowRadius = radius * 1.18;
            for (let i = glowSteps; i > 0; i--) {
                const t = i / glowSteps;
                const glowRadius = Phaser.Math.Linear(radius * 1.06, outerGlowRadius, t);
                const glowAlpha = Phaser.Math.Linear(0.05, 0.18, t);
                const glowColor = this.interpolateColor(color, 0x000000, 0.35 * t);
                graphics.fillStyle(glowColor, glowAlpha);
                graphics.fillCircle(centerX, centerY, glowRadius);
            }
        }
        
        // Draw gradient
        const centerColor = this.interpolateColor(color, 0xffffff, 0.3);
        const edgeColor = this.interpolateColor(color, 0x000000, 0.5);
        
        for (let i = gradientSteps; i >= 0; i--) {
            const t = i / gradientSteps;
            const stepColor = this.interpolateColor(edgeColor, centerColor, 1 - t);
            const alpha = Phaser.Math.Linear(0.35, 0.96, 1 - t);
            const currentRadius = radius * (0.32 + 0.68 * t);
            graphics.fillStyle(stepColor, alpha);
            graphics.fillCircle(centerX, centerY, currentRadius);
        }
        
        // Add border
        graphics.lineStyle(2, 0x000000, 0.5);
        graphics.strokeCircle(centerX, centerY, radius);
        
        // Draw to render texture
        rt.draw(graphics, 0, 0);
        rt.saveTexture(textureKey);
        
        // Cleanup
        graphics.destroy();
        rt.destroy();
        
        return textureKey;
    }
    
    // 🚀 PERFORMANCE: Generate and cache head texture with highlight
    private getOrCreateHeadTexture(color: number, radius: number, quality: 'high' | 'medium' | 'low'): string {
        const textureKey = `head_${color.toString(16)}_${radius}_${quality}`;
        
        if (this.textures.exists(textureKey)) {
            return textureKey;
        }
        
        const size = Math.ceil(radius * 3);
        const rt = this.add.renderTexture(0, 0, size, size).setVisible(false);
        const graphics = this.add.graphics();
        
        const centerX = size / 2;
        const centerY = size / 2;
        
        // Draw shadow
        graphics.fillStyle(0x000000, 0.18);
        graphics.fillCircle(centerX + 3, centerY + 4, radius * 1.08);
        
        // Draw outer glow
        if (quality !== 'low') {
            const glowSteps = quality === 'high' ? 4 : 2;
            const outerGlowRadius = radius * 1.18;
            for (let i = glowSteps; i > 0; i--) {
                const t = i / glowSteps;
                const glowRadius = Phaser.Math.Linear(radius * 1.06, outerGlowRadius, t);
                const glowAlpha = Phaser.Math.Linear(0.05, 0.18, t);
                const glowColor = this.interpolateColor(color, 0x000000, 0.35 * t);
                graphics.fillStyle(glowColor, glowAlpha);
                graphics.fillCircle(centerX, centerY, glowRadius);
            }
        }
        
        // Draw gradient
        const gradientSteps = quality === 'high' ? 12 : quality === 'medium' ? 6 : 3;
        const centerColor = this.interpolateColor(color, 0xffffff, 0.3);
        const edgeColor = this.interpolateColor(color, 0x000000, 0.5);
        
        for (let i = gradientSteps; i >= 0; i--) {
            const t = i / gradientSteps;
            const stepColor = this.interpolateColor(edgeColor, centerColor, 1 - t);
            const alpha = Phaser.Math.Linear(0.35, 0.96, 1 - t);
            const currentRadius = radius * (0.32 + 0.68 * t);
            graphics.fillStyle(stepColor, alpha);
            graphics.fillCircle(centerX, centerY, currentRadius);
        }
        
        // Add highlight
        graphics.fillStyle(0xffffff, 0.12);
        graphics.fillCircle(centerX - radius * 0.28, centerY - radius * 0.28, radius * 0.48);
        
        // Add border
        graphics.lineStyle(2, 0x000000, 0.5);
        graphics.strokeCircle(centerX, centerY, radius);
        
        rt.draw(graphics, 0, 0);
        rt.saveTexture(textureKey);
        
        graphics.destroy();
        rt.destroy();
        
        return textureKey;
    }
    
    // 🚀 PERFORMANCE: Determine rendering quality based on segment count
    private getRenderingQuality(segmentCount: number): 'high' | 'medium' | 'low' {
        if (segmentCount < this.SEGMENT_COUNT_LOW) return 'high';
        if (segmentCount < this.SEGMENT_COUNT_MEDIUM) return 'medium';
        return 'low';
    }
    
    // 🚀 PERFORMANCE: Cached viewport bounds to avoid recalculation
    private cachedViewportBounds: {
        left: number;
        right: number;
        top: number;
        bottom: number;
        cameraX: number;
        cameraY: number;
    } | null = null;
    
    // 🚀 PERFORMANCE: Check if position is in viewport with cached bounds
    private isInViewport(x: number, y: number): boolean {
        const cam = this.cameras.main;
        const currentCameraX = cam.scrollX;
        const currentCameraY = cam.scrollY;
        
        // Only recalculate bounds if camera moved significantly or bounds are not cached
        if (!this.cachedViewportBounds || 
            Math.abs(currentCameraX - this.cachedViewportBounds.cameraX) > this.cameraMoveThreshold ||
            Math.abs(currentCameraY - this.cachedViewportBounds.cameraY) > this.cameraMoveThreshold) {
            
            this.cachedViewportBounds = {
                left: currentCameraX - this.viewportBuffer,
                right: currentCameraX + cam.width + this.viewportBuffer,
                top: currentCameraY - this.viewportBuffer,
                bottom: currentCameraY + cam.height + this.viewportBuffer,
                cameraX: currentCameraX,
                cameraY: currentCameraY
            };
        }
        
        const bounds = this.cachedViewportBounds;
        return (
            x >= bounds.left &&
            x <= bounds.right &&
            y >= bounds.top &&
            y <= bounds.bottom
        );
    }
    
    // 🚀 PERFORMANCE: Adaptive quality settings based on FPS
    private adaptQualitySettings(): void {
        if (this.currentFPS >= 58) {
            // High performance - use best quality settings
            this.viewportBuffer = 160;
            this.minimapUpdateInterval = 3;
            this.leaderboardUpdateInterval = 9;
            this.segmentUpdateBatchSize = 14;
            this.enableVisualEffects = true;
            this.enableParticleEffects = true;
            this.enableFoodAnimations = true;
            this.enableAttractionAura = true;
        } else if (this.currentFPS >= 50) {
            // Medium performance - slightly trimmed quality
            this.viewportBuffer = 120;
            this.minimapUpdateInterval = 4;
            this.leaderboardUpdateInterval = 12;
            this.segmentUpdateBatchSize = 10;
            this.enableVisualEffects = true;
            this.enableParticleEffects = true;
            this.enableFoodAnimations = true;
            this.enableAttractionAura = true;
        } else if (this.currentFPS >= 40) {
            // Low performance - prioritize responsiveness
            this.viewportBuffer = 90;
            this.minimapUpdateInterval = 6;
            this.leaderboardUpdateInterval = 16;
            this.segmentUpdateBatchSize = 8;
            this.enableVisualEffects = true;
            this.enableParticleEffects = false; // Disable particle effects
            this.enableFoodAnimations = true;
            this.enableAttractionAura = false; // Disable attraction aura
        } else if (this.currentFPS >= 30) {
            // Very low performance - aggressive optimization
            this.viewportBuffer = 70;
            this.minimapUpdateInterval = 8;
            this.leaderboardUpdateInterval = 22;
            this.segmentUpdateBatchSize = 6;
            this.enableVisualEffects = false; // Disable visual effects
            this.enableParticleEffects = false;
            this.enableFoodAnimations = false; // Disable food animations
            this.enableAttractionAura = false;
        } else {
            // Extremely low performance - minimal everything
            this.viewportBuffer = 60;
            this.minimapUpdateInterval = 10;
            this.leaderboardUpdateInterval = 28;
            this.segmentUpdateBatchSize = 4;
            this.enableVisualEffects = false;
            this.enableParticleEffects = false;
            this.enableFoodAnimations = false;
            this.enableAttractionAura = false;
        }
        
        // Apply visual effects changes
        this.applyVisualEffectsSettings();
    }
    
    // 🚀 PERFORMANCE: Apply visual effects settings based on FPS
    private applyVisualEffectsSettings(): void {
        // Disable/enable boost particle effect
        if (this.boostEffect) {
            if (!this.enableParticleEffects && this.isBoosting) {
                this.boostEffect.stop();
            }
        }
        
        // Disable/enable attraction aura
        if (this.headAttractionAura) {
            if (!this.enableAttractionAura) {
                this.headAttractionAura.setVisible(false);
            }
        }
    }
    
    // 🚀 PERFORMANCE: Adaptive FPS target - reduce target FPS when performance is low
    private lastFPSAdaptationTime: number = 0;
    private readonly fpsAdaptationInterval: number = 2000; // Check every 2 seconds
    private currentTargetFPS: number = 120; // Start with default target
    
    private adaptFPSTarget(): void {
        const now = this.time.now;
        
        // Only adapt FPS target periodically
        if (now - this.lastFPSAdaptationTime < this.fpsAdaptationInterval) {
            return;
        }
        
        this.lastFPSAdaptationTime = now;
        
        const targetFPS = this.game.config.fps?.target || 120;
        const actualFPS = this.currentFPS;
        
        // If actual FPS is consistently below 70% of target, reduce target FPS
        if (actualFPS < targetFPS * 0.7) {
            if (targetFPS > 60) {
                // Reduce to 60 FPS
                this.currentTargetFPS = 60;
                this.game.loop.targetFps = 60;
                console.log(`[Performance] Reduced target FPS to 60 (actual: ${actualFPS})`);
            } else if (targetFPS > 30 && actualFPS < 42) {
                // Reduce to 30 FPS if still struggling
                this.currentTargetFPS = 30;
                this.game.loop.targetFps = 30;
                console.log(`[Performance] Reduced target FPS to 30 (actual: ${actualFPS})`);
            }
        } else if (actualFPS >= targetFPS * 0.9 && targetFPS < 120) {
            // If FPS is stable and good, try increasing target FPS back
            if (targetFPS === 30 && actualFPS >= 27) {
                this.currentTargetFPS = 60;
                this.game.loop.targetFps = 60;
                console.log(`[Performance] Increased target FPS to 60 (actual: ${actualFPS})`);
            } else if (targetFPS === 60 && actualFPS >= 54) {
                this.currentTargetFPS = 120;
                this.game.loop.targetFps = 120;
                console.log(`[Performance] Increased target FPS to 120 (actual: ${actualFPS})`);
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
            // 🚀 PERFORMANCE: Only log in development
            if (process.env.NODE_ENV === 'development') {
                console.log('[GameScene] [setupRoomHandlers] [playerDied] Received:', message, 'Current playerId:', this.playerId);
            }
            
            if (message && message.playerId === this.playerId) {
                this.handlePlayerDeath();
            }
            
            // Play death sound
            if (this.deathSound) {
                this.deathSound.play();
            }
        });
        
        // Handle initial foods message
        room.onMessage('initialFoods', (message) => {
            
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
                // 🎯 Save food position and value before destroying
                const foodX = foodSprite.x;
                const foodY = foodSprite.y;
                const foodValue = foodSprite.getData('value') || 1;
                
                // 🧹 Stop all tweens and cleanup
                const attractTween = foodSprite.getData('attractTween') as Phaser.Tweens.Tween | null;
                if (attractTween) {
                    attractTween.stop();
                    this.tweens.remove(attractTween);
                }
                
                this.stopFoodTweens(foodSprite);
                
                const glow = foodSprite.getData('glow');
                if (glow) {
                    this.tweens.killTweensOf(glow);
                    glow.destroy();
                }
                
                // 🗑️ Destroy food sprite
                foodSprite.destroy();
                this.foods.delete(message.id);
                
                // 🎮 Play effects only if it's the current player who ate the food
                if (message.playerId === this.playerId) {
                    this.eatSound.play({ volume: 0.5 });
                    this.addEatEffect(foodX, foodY, foodValue);
                }
            }
        });
        
        // Add a specific handler for playerKilled events
        room.onMessage('playerKilled', (message) => {
            
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
                this.vipConfig = this.normalizeVipConfig(message);;
            }
        });
    }
    
    // 🚀 PERFORMANCE: Ultra-optimized background using preloaded texture
    private createBackground() {
        // Create dark navy/charcoal background to match reference
        const bg = this.add.graphics();
        bg.fillStyle(0x14161f, 1); // Dark navy charcoal base color
        bg.fillRect(0, 0, this.worldWidth, this.worldHeight);
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
        
        const title = this.createSharpText(cardWidth / 2, 15, 'PLAYER STATS', { 
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
        
        this.scoreText = this.createSharpText(45, 50, 'Score: 0', { 
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
        
        this.playerRankText = this.createSharpText(45, 80, 'Rank: -/-', { 
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
        
        this.fpsText = this.createSharpText(45, 110, 'FPS: 0', { 
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

            this.vipCreditText = this.createSharpText(45, 140, 'Credit: 0', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffeb8a',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0, 0.5);
            this.statsPanel.add(this.vipCreditText);

            this.vipInfoText = this.createSharpText(10, cardHeight - 10, '', {
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
        
        // Create leaderboard UI (once)
        this.createLeaderboard();
        
        // Quit button
        this.createQuitButton(20, height-80);
    }
    
    private createLeaderboard() {
        const width = this.cameras.main.width;
        
        // Create container for leaderboard
        this.leaderboardPanel = this.add.container(width - 130, 10);
        this.leaderboardPanel.setScrollFactor(0);
        this.leaderboardPanel.setDepth(100);
        
        // Background with gradient (cached)
        const bgWidth = 240;
        const bgHeight = 300;
        this.leaderboardBackground = this.add.graphics();
        this.leaderboardBackground.fillGradientStyle(
            0x0d2828, 0x0d2828,
            0x081818, 0x081818,
            1, 1, 1, 1
        );
        this.leaderboardBackground.fillRoundedRect(-bgWidth/2, 0, bgWidth, bgHeight, 10);
        this.leaderboardBackground.lineStyle(2, 0x2d7a7a, 0.8);
        this.leaderboardBackground.strokeRoundedRect(-bgWidth/2, 0, bgWidth, bgHeight, 10);
        this.leaderboardPanel.add(this.leaderboardBackground);
        
        // Title background
        const titleBg = this.add.graphics();
        titleBg.fillStyle(0x1a5555, 0.8);
        titleBg.fillRoundedRect(-bgWidth/2, 0, bgWidth, 40, { tl: 10, tr: 10, bl: 0, br: 0 });
        this.leaderboardPanel.add(titleBg);
        
        // Title (cached)
        this.leaderboardTitle = this.createSharpText(0, 20, 'LEADERBOARD', { 
            fontFamily: 'Arial',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        this.leaderboardPanel.add(this.leaderboardTitle);
        
        // Column headers (cached)
        const headerY = 50;
        this.leaderboardHeaders = {
            rank: this.createSharpText(-bgWidth/2 + 20, headerY, 'RANK', { 
                    fontFamily: 'Arial',
                fontSize: '12px',
                color: '#aaaaff',
                fontStyle: 'bold'
            }),
            name: this.createSharpText(-bgWidth/2 + 60, headerY, 'NAME', { 
                fontFamily: 'Arial', 
                fontSize: '12px',
                color: '#aaaaff',
                fontStyle: 'bold'
            }),
            score: this.createSharpText(-bgWidth/2 + 140, headerY, 'SCORE', { 
                fontFamily: 'Arial', 
                fontSize: '12px',
                color: '#aaaaff',
                fontStyle: 'bold'
            }),
            kills: this.createSharpText(-bgWidth/2 + 190, headerY, 'KILLS', { 
                fontFamily: 'Arial', 
                fontSize: '12px',
                color: '#aaaaff',
                fontStyle: 'bold'
            })
        };
        
        this.leaderboardPanel.add(this.leaderboardHeaders.rank);
        this.leaderboardPanel.add(this.leaderboardHeaders.name);
        this.leaderboardPanel.add(this.leaderboardHeaders.score);
        this.leaderboardPanel.add(this.leaderboardHeaders.kills);
        
        // Separator line
        const separator = this.add.graphics();
        separator.lineStyle(1, 0x2d7a7a, 0.5);
        separator.lineBetween(-bgWidth/2 + 10, headerY + 15, bgWidth/2 - 10, headerY + 15);
        this.leaderboardPanel.add(separator);
        
        // Create 10 player entries (cached for reuse)
        for (let i = 0; i < 10; i++) {
            const rowY = 75 + (i * 22);
            
            // Row background (will be shown only for current player)
            const rowBg = this.add.graphics();
            rowBg.setVisible(false); // Hidden by default
            this.leaderboardPanel.add(rowBg);
            
            // Rank text
            const rankText = this.createSharpText(-bgWidth/2 + 20, rowY, '', { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: '#ffffff'
            }).setOrigin(0, 0.5);
            
            // Color circle
            const colorCircle = this.add.graphics();
            
            // Name text
            const nameText = this.createSharpText(-bgWidth/2 + 65, rowY, '', { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: '#ffffff'
            }).setOrigin(0, 0.5);
            
            // Score text
            const scoreText = this.createSharpText(-bgWidth/2 + 140, rowY, '', { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: '#ffffff'
            }).setOrigin(0, 0.5);
            
            // Kills text
            const killsText = this.createSharpText(-bgWidth/2 + 190, rowY, '', { 
                fontFamily: 'Arial', 
                fontSize: '14px',
                color: '#ffffff'
            }).setOrigin(0, 0.5);
            
            // Add to container
            this.leaderboardPanel.add(rankText);
            this.leaderboardPanel.add(colorCircle);
            this.leaderboardPanel.add(nameText);
            this.leaderboardPanel.add(scoreText);
            this.leaderboardPanel.add(killsText);
            
            // Cache entry objects
            this.leaderboardEntries.set(i, {
                rankText,
                colorCircle,
                nameText,
                scoreText,
                killsText,
                rowBg
            });
            
            // Hide all entries by default
            rankText.setVisible(false);
            colorCircle.setVisible(false);
            nameText.setVisible(false);
            scoreText.setVisible(false);
            killsText.setVisible(false);
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
        const minimapTitle = this.createSharpText(
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
        const deathText = this.createSharpText(width/2, height/2 - 100, 'YOU DIED', {
            fontFamily: 'Arial',
            fontSize: '64px',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.deathOverlay.add(deathText);
        
        // Add score text with a name so we can find it later
        const scoreText = this.createSharpText(width/2, height/2, 'Score: 0', {
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
        this.respawnButton = this.createSharpText(width/2, height/2 + 100, 'RESPAWN', {
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
            this.respawn();
        });
        
        // Menu button
        this.menuButton = this.createSharpText(width/2, height/2 + 180, 'BACK TO MENU', {
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
    
    // 🚀 PERFORMANCE: Optimized boost particles with reduced count and lifespan
    private createBoostEffect() {
        // Create particle emitter for boost effect
        if (this.game.textures.exists('boost-particle')) {
            this.boostEffect = this.add.particles(0, 0, 'boost-particle', {
                lifespan: 150, // Reduced from 200
                speed: { min: 40, max: 80 }, // Reduced from 50-100
                scale: { start: 0.4, end: 0 }, // Reduced from 0.5
                alpha: { start: 0.6, end: 0 }, // Reduced from 0.7
                blendMode: 'ADD',
                emitting: false,
                frequency: 50, // Limit particle emission rate
                maxParticles: 20 // Limit total particles
            });
        } else {
            // Fallback if texture doesn't exist
            console.warn('Boost particle texture not found, using default');
            this.boostEffect = this.add.particles(0, 0, 'food', {
                lifespan: 150,
                speed: { min: 40, max: 80 },
                scale: { start: 0.4, end: 0 },
                alpha: { start: 0.6, end: 0 },
                blendMode: 'ADD',
                emitting: false,
                frequency: 50,
                maxParticles: 20
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
        
        // Check if player has enough score to boost (minimum 10 points)
        if (this.gameState && this.playerId) {
            const player = this.gameState.players.get(this.playerId);
            if (!player || player.score < 10) {
                return; // Not enough score to boost
            }
        }
        
        this.isBoosting = true;
        room.send('boost', true);
        
        // Play boost sound
        this.boostSound.play({ volume: 0.3 });
        
        // Start particle effect only if enabled
        if (this.boostEffect && this.enableParticleEffects) {
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
    
    private updateSnakes(delta: number) {
        if (!this.gameState) return;
        const normalizedDelta = Number.isFinite(delta) ? delta : 16.6667;
        const baseHeadLerp = (normalizedDelta / 16.6667) * this.headLerpScale;
        
        // First, remove snakes that are no longer in the game
        this.snakes.forEach((snake, id) => {
            const player = this.gameState.players.get(id);
            if (!player || !player.alive) {
                // Destroy all segments
                snake.destroy(true);
                this.snakes.delete(id);
                
                // 🚀 PERFORMANCE: Remove eyes graphics
                const eyesGraphics = this.snakeEyes.get(id);
                if (eyesGraphics) {
                    eyesGraphics.destroy();
                    this.snakeEyes.delete(id);
                }
                
                // Remove player name
                const playerText = this.playerTexts.get(id);
                if (playerText) {
                    playerText.destroy();
                    this.playerTexts.delete(id);
                }
                
                // Remove segment history
                this.playerSegmentHistories.delete(id);
                this.playerRenderPositions.delete(id);
                
                // 🚀 PERFORMANCE: Clean up eyes cache
                this.lastEyesAngle.delete(id);
                this.lastEyesBoosting.delete(id);
                this.lastEyesBlinking.delete(id);
                this.lastEyesRadius.delete(id);
            }
        });
        
        // 🚀 PERFORMANCE: Increment batch update counter for segment batching
        this.segmentUpdateFrameCounter++;
        
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

            // Check if this is the current player
            const isCurrentPlayer = id === this.playerId;
            const displayName = isCurrentPlayer ? `${playerData.name} (me)` : playerData.name;
            const nameColor = isCurrentPlayer ? '#ffff00' : '#ffffff'; // Yellow for current player, white for others
            
            let nameText = this.playerTexts.get(id);
            if (!nameText || !nameText.scene) {
                if (nameText) {
                    nameText.destroy();
                }
                nameText = this.createSharpText(0, 0, displayName, {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: nameColor,
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
                nameText.setText(displayName);
                nameText.setColor(nameColor);
            }
            
            const score = Number.isFinite(playerData.score) ? Math.max(0, playerData.score) : 0;

            // 🔄 Get segment count directly from backend (source of truth)
            const segments = snake.getChildren();
            const targetSegmentCount = playerData.totalLength || this.baseSnakeSegments;
            const currentSegmentCount = segments.length;
            
            // 🚀 PERFORMANCE: Determine quality and dynamic history size
            const quality = this.getRenderingQuality(targetSegmentCount);
            const dynamicHistorySize = Math.max(300, Math.min(this.historySize, 2000 - targetSegmentCount * 5));
            
            // Calculate radius and color once
            const colorInt = parseInt(color.replace('#', '0x'));
            const radiusGrowth = this.computeProgressiveGrowth(
                score,
                this.radiusGrowthBaseThreshold,
                this.radiusGrowthThresholdIncrement
            );
            const scaledGrowth = (radiusGrowth.level + radiusGrowth.progress) * this.radiusGrowthPerLevel;
            const baseScale = Math.min(this.maxSnakeScale, 1 + scaledGrowth);
            const snakeRadius = this.baseSnakeRadius * baseScale;
            
            if (createdNewSnake && snake) {
                const initialSegments = this.baseSnakeSegments;
                for (let i = 0; i < initialSegments; i++) {
                    const isHead = i === 0;
                    // 🚀 PERFORMANCE: Use sprite with cached texture instead of graphics
                    const textureKey = isHead 
                        ? this.getOrCreateHeadTexture(colorInt, snakeRadius, quality)
                        : this.getOrCreateSegmentTexture(colorInt, snakeRadius, quality);
                    const segment = this.add.sprite(0, 0, textureKey);
                    segment.setData('isHead', isHead);
                    segment.setData('color', color);
                    segment.setData('textureKey', textureKey);
                    segment.setDepth(isHead ? 20 : 10);
                    snake.add(segment);
                }
            }
            if (!snake) {
                return;
            }
            
            if (currentSegmentCount < targetSegmentCount) {
                // Add segments if needed
                for (let i = currentSegmentCount; i < targetSegmentCount; i++) {
                    // 🚀 PERFORMANCE: Use sprite with cached texture
                    const textureKey = this.getOrCreateSegmentTexture(colorInt, snakeRadius, quality);
                    const segment = this.add.sprite(0, 0, textureKey);
                    segment.setData('isHead', false);
                    segment.setData('color', color);
                    segment.setData('textureKey', textureKey);
                    segment.setDepth(10);
                    snake.add(segment);
                }
            } else if (currentSegmentCount > targetSegmentCount) {
                // Remove segments if needed
                for (let i = targetSegmentCount; i < segments.length; i++) {
                    segments[i].destroy();
                }
            }
            
            // Get the head position from the server
            const headPosition = playerData.headPosition;
            if (!headPosition) return;

            const previousRenderPosition = this.playerRenderPositions.get(id);
            const clampedHeadLerp = Phaser.Math.Clamp(baseHeadLerp, this.headLerpMin, this.headLerpMax);
            const headDistance = previousRenderPosition
                ? Phaser.Math.Distance.Between(previousRenderPosition.x, previousRenderPosition.y, headPosition.x, headPosition.y)
                : 0;
            const catchupBoost = headDistance > this.headCatchupDistance
                ? Math.min((headDistance - this.headCatchupDistance) / this.headCatchupDistance, this.headCatchupMaxBoost)
                : 0;
            const boostedMax = playerData.boosting ? this.headLerpBoostedMax : this.headLerpMax;
            const effectiveHeadLerp = Phaser.Math.Clamp(clampedHeadLerp * (1 + catchupBoost), this.headLerpMin, boostedMax);
            const renderX = previousRenderPosition
                ? Phaser.Math.Linear(previousRenderPosition.x, headPosition.x, effectiveHeadLerp)
                : headPosition.x;
            const renderY = previousRenderPosition
                ? Phaser.Math.Linear(previousRenderPosition.y, headPosition.y, effectiveHeadLerp)
                : headPosition.y;
            const renderPosition = { x: renderX, y: renderY };

            this.playerRenderPositions.set(id, renderPosition);
            
            // Get or create segment history for this player
            let segmentHistory = this.playerSegmentHistories.get(id);
            if (!segmentHistory) {
                segmentHistory = [];
                this.playerSegmentHistories.set(id, segmentHistory);
            }
            
            const historyHead = segmentHistory[0];
            if (
                !historyHead ||
                Phaser.Math.Distance.Between(historyHead.x, historyHead.y, renderPosition.x, renderPosition.y) > 0.1
            ) {
                segmentHistory.unshift({ x: renderPosition.x, y: renderPosition.y });
            }
            
            // 🚀 PERFORMANCE: Trim history to dynamic size
            if (segmentHistory.length > dynamicHistorySize) {
                segmentHistory.length = dynamicHistorySize;
            }

            if (createdNewSnake && segmentHistory.length === 1) {
                const maxDistanceNeeded = segments.length * this.segmentSpacing;
                for (let dist = this.segmentSpacing; dist <= maxDistanceNeeded; dist += this.segmentSpacing) {
                    segmentHistory.push({ x: renderPosition.x, y: renderPosition.y });
                }
            }
            
            // 🚀 PERFORMANCE: Render head with sprite
            const headObj = segments[0] as Phaser.GameObjects.Sprite;
            if (headObj) {
                // 🚀 PERFORMANCE: Only update if in viewport or if it's the player
                const shouldRender = id === this.playerId || this.isInViewport(renderPosition.x, renderPosition.y);
                
                if (shouldRender) {
                    headObj.setVisible(true);
                    headObj.setPosition(renderPosition.x, renderPosition.y);
                    
                    // Update texture if quality changed
                    const expectedTextureKey = this.getOrCreateHeadTexture(colorInt, snakeRadius, quality);
                    if (headObj.texture.key !== expectedTextureKey) {
                        headObj.setTexture(expectedTextureKey);
                        headObj.setData('textureKey', expectedTextureKey);
                    }
                    
                    // Add boost glow effect for head only
                    if (playerData.boosting) {
                        headObj.setTint(0xffcccc);
                    } else {
                        headObj.clearTint();
                    }
                    
                    // Update name text position cố định với đầu rắn
                    const nameText = this.playerTexts.get(id);
                    if (nameText && nameText.scene) {
                        nameText.setPosition(renderPosition.x, renderPosition.y - 40);
                        // Scale text based on player score - similar to snake scaling
                        const score = Number.isFinite(playerData.score) ? Math.max(0, playerData.score) : 0;
                        const baseScale = Math.min(1.5, 1 + (score / 100));
                        nameText.setScale(baseScale);
                    }
                    
                    // 🚀 PERFORMANCE: Draw eyes on overlay graphics - only redraw when state changes
                    let eyesGraphics = this.snakeEyes.get(id);
                    if (!eyesGraphics || !eyesGraphics.scene) {
                        if (eyesGraphics) {
                            eyesGraphics.destroy();
                        }
                        eyesGraphics = this.add.graphics();
                        eyesGraphics.setDepth(21); // Above head
                        this.snakeEyes.set(id, eyesGraphics);
                    }
                    
                    eyesGraphics.setPosition(renderPosition.x, renderPosition.y);
                    eyesGraphics.setVisible(true);
                    
                    // Check if eyes need to be redrawn
                    this.updateBlinkEffect(id);
                    const currentBlinking = this.isBlinking.get(id) || false;
                    const lastAngle = this.lastEyesAngle.get(id);
                    const lastBoosting = this.lastEyesBoosting.get(id);
                    const lastBlinking = this.lastEyesBlinking.get(id);
                    const lastRadius = this.lastEyesRadius.get(id);
                    
                    const needsRedraw = 
                        lastAngle === undefined || 
                        Math.abs(lastAngle - playerData.angle) > 0.5 || // Redraw if angle changed > 0.5 degrees
                        lastBoosting !== playerData.boosting ||
                        lastBlinking !== currentBlinking ||
                        lastRadius === undefined ||
                        Math.abs(lastRadius - snakeRadius) > 0.5; // Redraw if radius changed significantly
                    
                    if (needsRedraw) {
                        eyesGraphics.clear();
                        this.drawSnakeEyes(eyesGraphics, playerData.angle, snakeRadius, playerData.boosting, id);
                        // Cache current state
                        this.lastEyesAngle.set(id, playerData.angle);
                        this.lastEyesBoosting.set(id, playerData.boosting);
                        this.lastEyesBlinking.set(id, currentBlinking);
                        this.lastEyesRadius.set(id, snakeRadius);
                    }
                } else {
                    headObj.setVisible(false);
                    const eyesGraphics = this.snakeEyes.get(id);
                    if (eyesGraphics) {
                        eyesGraphics.setVisible(false);
                    }
                }
            }

            // 🚀 PERFORMANCE: Render body segments with batch updates and viewport culling
            // Calculate which segments to update this frame (batch update)
            // Note: isCurrentPlayer already declared above for this player
            const totalSegments = segments.length - 1; // Exclude head
            // Always update all segments for current player, batch others
            const segmentsToUpdate = isCurrentPlayer ? totalSegments : Math.min(this.segmentUpdateBatchSize, totalSegments);
            const startIndex = isCurrentPlayer ? 1 : (1 + (this.segmentUpdateFrameCounter % Math.ceil(totalSegments / this.segmentUpdateBatchSize)) * this.segmentUpdateBatchSize);
            
            for (let i = 1; i < segments.length; i++) {
                const segmentObj = segments[i] as Phaser.GameObjects.Sprite;
                if (!segmentObj) continue;
                
                // 🚀 PERFORMANCE: Only update segments in current batch (except for current player)
                if (!isCurrentPlayer && (i < startIndex || i >= startIndex + segmentsToUpdate)) {
                    // Skip update but still check visibility
                    const lastKnownX = segmentObj.x;
                    const lastKnownY = segmentObj.y;
                    const shouldRender = this.isInViewport(lastKnownX, lastKnownY);
                    segmentObj.setVisible(shouldRender);
                    continue;
                }
                    
                const targetDistance = i * this.segmentSpacing;
                const targetPosition = this.getPositionFromHistory(segmentHistory, targetDistance, renderPosition);

                const currentX = Number.isFinite(segmentObj.x) ? segmentObj.x : targetPosition.x;
                const currentY = Number.isFinite(segmentObj.y) ? segmentObj.y : targetPosition.y;

                let newX = targetPosition.x;
                let newY = targetPosition.y;

                if (!playerData.boosting) {
                    const lerpFactor = Math.max(0.35, 0.6 - i * 0.02);
                    newX = Phaser.Math.Linear(currentX, targetPosition.x, lerpFactor);
                    newY = Phaser.Math.Linear(currentY, targetPosition.y, lerpFactor);
                }

                const previousSegment = i === 1 ? headObj : (segments[i - 1] as Phaser.GameObjects.Sprite);
                const clamped = this.clampToSpacing(
                    previousSegment.x,
                    previousSegment.y,
                    newX,
                    newY,
                    this.segmentSpacing
                );

                // 🚀 PERFORMANCE: Viewport culling - only render visible segments
                const shouldRender = isCurrentPlayer || this.isInViewport(clamped.x, clamped.y);
                
                if (shouldRender) {
                    segmentObj.setVisible(true);
                    segmentObj.setPosition(clamped.x, clamped.y);
                    
                    // Update texture if quality changed
                    const expectedTextureKey = this.getOrCreateSegmentTexture(colorInt, snakeRadius, quality);
                    if (segmentObj.texture.key !== expectedTextureKey) {
                        segmentObj.setTexture(expectedTextureKey);
                        segmentObj.setData('textureKey', expectedTextureKey);
                    }
                } else {
                    segmentObj.setVisible(false);
                }
            }
        });
    }
    
    private computeProgressiveGrowth(
        rawScore: number,
        baseThreshold: number,
        thresholdIncrement: number
    ): { level: number; nextThreshold: number; progress: number } {
        const score = Number.isFinite(rawScore) ? Math.max(0, rawScore) : 0;
        const sanitizedBase = baseThreshold > 0 ? baseThreshold : 1;

        if (score <= 0) {
            return {
                level: 0,
                nextThreshold: sanitizedBase,
                progress: 0
            };
        }

        if (thresholdIncrement <= 0) {
            const level = Math.floor(score / sanitizedBase);
            const consumed = level * sanitizedBase;
            const progress = sanitizedBase > 0 ? Phaser.Math.Clamp((score - consumed) / sanitizedBase, 0, 1) : 0;

            return {
                level,
                nextThreshold: sanitizedBase,
                progress
            };
        }

        const a = thresholdIncrement / 2;
        const b = sanitizedBase - thresholdIncrement / 2;
        const discriminant = b * b + 4 * a * score;
        const sqrtDiscriminant = Math.sqrt(discriminant);
        const rawLevel = Math.floor(Math.max(0, (-b + sqrtDiscriminant) / (2 * a)));

        const consumed = rawLevel * sanitizedBase + (thresholdIncrement * rawLevel * (rawLevel - 1)) / 2;
        const nextThreshold = sanitizedBase + rawLevel * thresholdIncrement;
        const progress = nextThreshold > 0 ? Phaser.Math.Clamp((score - consumed) / nextThreshold, 0, 1) : 0;

        return {
            level: rawLevel,
            nextThreshold,
            progress
        };
    }

    private getPositionFromHistory(
        history: Array<{ x: number; y: number }>,
        distance: number,
        fallback: { x: number; y: number }
    ): { x: number; y: number } {
        if (!history.length) {
            return { x: fallback.x, y: fallback.y };
        }

        let accumulated = 0;

        for (let index = 0; index < history.length - 1; index++) {
            const currentPoint = history[index];
            const nextPoint = history[index + 1];

            const segmentDistance = Phaser.Math.Distance.Between(
                currentPoint.x,
                currentPoint.y,
                nextPoint.x,
                nextPoint.y
            );

            if (segmentDistance === 0) {
                continue;
            }

            if (accumulated + segmentDistance >= distance) {
                const t = (distance - accumulated) / segmentDistance;
                return {
                    x: Phaser.Math.Linear(currentPoint.x, nextPoint.x, t),
                    y: Phaser.Math.Linear(currentPoint.y, nextPoint.y, t)
                };
            }

            accumulated += segmentDistance;
        }

        const lastPoint = history[history.length - 1];
        return {
            x: lastPoint?.x ?? fallback.x,
            y: lastPoint?.y ?? fallback.y
        };
    }

    private clampToSpacing(
        anchorX: number,
        anchorY: number,
        targetX: number,
        targetY: number,
        spacing: number
    ): { x: number; y: number } {
        const dx = targetX - anchorX;
        const dy = targetY - anchorY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= spacing || distance === 0) {
            return { x: targetX, y: targetY };
        }

        const ratio = spacing / distance;
        return {
            x: anchorX + dx * ratio,
            y: anchorY + dy * ratio
        };
    }
    
    private drawSnakeEyes(graphics: Phaser.GameObjects.Graphics, angle: number, headRadius: number, isBoosting: boolean = false, snakeId: string) {
        // Check if eyes are blinking
        const isBlinking = this.isBlinking.get(snakeId) || false;
        
        // Calculate eye positions based on snake direction
        const angleRad = Phaser.Math.DegToRad(angle);
        
        // ===== BIGGER EYES =====
        const eyeDistance = headRadius * 0.45; // Distance from center (increased)
        const baseEyeRadius = headRadius * 0.35; // Eye size - MUCH BIGGER (increased from 0.2 to 0.35)
        
        // When boosting, make eyes even bigger
        const eyeRadius = isBoosting ? baseEyeRadius * 1.15 : baseEyeRadius;
        
        // Calculate positions for both eyes (left and right of center)
        const perpAngle = angleRad + Math.PI / 2; // Perpendicular to direction
        
        // Left eye
        const leftEyeX = Math.cos(perpAngle) * eyeDistance;
        const leftEyeY = Math.sin(perpAngle) * eyeDistance;
        
        // Right eye  
        const rightEyeX = Math.cos(perpAngle + Math.PI) * eyeDistance;
        const rightEyeY = Math.sin(perpAngle + Math.PI) * eyeDistance;
        
        // Move eyes slightly forward
        const forwardOffset = headRadius * 0.35;
        const forwardX = Math.cos(angleRad) * forwardOffset;
        const forwardY = Math.sin(angleRad) * forwardOffset;
        
        if (isBlinking) {
            // Draw closed eyes (horizontal line)
            graphics.lineStyle(3, 0x000000, 1);
            graphics.beginPath();
            graphics.moveTo(leftEyeX + forwardX - eyeRadius, leftEyeY + forwardY);
            graphics.lineTo(leftEyeX + forwardX + eyeRadius, leftEyeY + forwardY);
            graphics.strokePath();
            
            graphics.beginPath();
            graphics.moveTo(rightEyeX + forwardX - eyeRadius, rightEyeY + forwardY);
            graphics.lineTo(rightEyeX + forwardX + eyeRadius, rightEyeY + forwardY);
            graphics.strokePath();
        } else {
            // ===== DRAW LEFT EYE =====
            // Eye white with subtle outline
            graphics.lineStyle(2, 0x000000, 0.5);
        graphics.fillStyle(0xffffff, 1); // White
        graphics.fillCircle(leftEyeX + forwardX, leftEyeY + forwardY, eyeRadius);
            graphics.strokeCircle(leftEyeX + forwardX, leftEyeY + forwardY, eyeRadius);
            
            // Colored iris (light blue/cyan for more character)
            graphics.fillStyle(0x4db8ff, 1);
            graphics.fillCircle(leftEyeX + forwardX, leftEyeY + forwardY, eyeRadius * 0.7);
            
            // Pupil - moves slightly in direction of movement
            const pupilRadius = eyeRadius * 0.4;
            const pupilOffsetX = Math.cos(angleRad) * (eyeRadius * 0.15);
            const pupilOffsetY = Math.sin(angleRad) * (eyeRadius * 0.15);
            
        graphics.fillStyle(0x000000, 1); // Black pupil
            graphics.fillCircle(
                leftEyeX + forwardX + pupilOffsetX, 
                leftEyeY + forwardY + pupilOffsetY, 
                pupilRadius
            );
            
            // Highlight for shine effect (makes eyes look alive)
            graphics.fillStyle(0xffffff, 0.9);
            graphics.fillCircle(
                leftEyeX + forwardX + pupilOffsetX - pupilRadius * 0.3, 
                leftEyeY + forwardY + pupilOffsetY - pupilRadius * 0.3, 
                pupilRadius * 0.4
            );
        
            // ===== DRAW RIGHT EYE =====
            // Eye white with subtle outline
            graphics.lineStyle(2, 0x000000, 0.5);
        graphics.fillStyle(0xffffff, 1); // White
        graphics.fillCircle(rightEyeX + forwardX, rightEyeY + forwardY, eyeRadius);
            graphics.strokeCircle(rightEyeX + forwardX, rightEyeY + forwardY, eyeRadius);
            
            // Colored iris
            graphics.fillStyle(0x4db8ff, 1);
            graphics.fillCircle(rightEyeX + forwardX, rightEyeY + forwardY, eyeRadius * 0.7);
            
            // Pupil - moves slightly in direction of movement
        graphics.fillStyle(0x000000, 1); // Black pupil
            graphics.fillCircle(
                rightEyeX + forwardX + pupilOffsetX, 
                rightEyeY + forwardY + pupilOffsetY, 
                pupilRadius
            );
            
            // Highlight for shine effect
            graphics.fillStyle(0xffffff, 0.9);
            graphics.fillCircle(
                rightEyeX + forwardX + pupilOffsetX - pupilRadius * 0.3, 
                rightEyeY + forwardY + pupilOffsetY - pupilRadius * 0.3, 
                pupilRadius * 0.4
            );
        }
    }

    private drawSnakeSegment(
        graphics: Phaser.GameObjects.Graphics,
        radius: number,
        baseColor: number,
        options?: {
            shadowOffsetX?: number;
            shadowOffsetY?: number;
            shadowScale?: number;
            highlight?: boolean;
        }
    ) {
        const { shadowOffsetX = 2, shadowOffsetY = 3, shadowScale = 1.05, highlight = false } = options ?? {};

        graphics.fillStyle(0x000000, 0.18);
        graphics.fillCircle(shadowOffsetX, shadowOffsetY, radius * shadowScale);

        const outerGlowRadius = radius * 1.18;
        const outerGlowSteps = 4;
        for (let i = outerGlowSteps; i > 0; i--) {
            const t = i / outerGlowSteps;
            const glowRadius = Phaser.Math.Linear(radius * 1.06, outerGlowRadius, t);
            const glowAlpha = Phaser.Math.Linear(0.05, 0.18, t);
            const glowColor = this.interpolateColor(baseColor, 0x000000, 0.35 * t);
            graphics.fillStyle(glowColor, glowAlpha);
            graphics.fillCircle(0, 0, glowRadius);
        }

        const steps = 12;
        const centerColor = this.interpolateColor(baseColor, 0xffffff, 0.3);
        const edgeColor = this.interpolateColor(baseColor, 0x000000, 0.5);

        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            const color = this.interpolateColor(edgeColor, centerColor, 1 - t);
            const alpha = Phaser.Math.Linear(0.35, 0.96, 1 - t);
            const currentRadius = radius * (0.32 + 0.68 * t);
            graphics.fillStyle(color, alpha);
            graphics.fillCircle(0, 0, currentRadius);
        }

        if (highlight) {
            graphics.fillStyle(0xffffff, 0.12);
            graphics.fillCircle(-radius * 0.28, -radius * 0.28, radius * 0.48);
        }

        // 🎨 Add dark border for better contrast
        graphics.lineStyle(2, 0x000000, 0.5); // 2px dark border with 70% opacity
        graphics.strokeCircle(0, 0, radius);
    }

    private interpolateColor(startColor: number, endColor: number, t: number): number {
        const start = Phaser.Display.Color.ValueToColor(startColor);
        const end = Phaser.Display.Color.ValueToColor(endColor);

        const r = Phaser.Math.Linear(start.red, end.red, t);
        const g = Phaser.Math.Linear(start.green, end.green, t);
        const b = Phaser.Math.Linear(start.blue, end.blue, t);

        return Phaser.Display.Color.GetColor(Math.round(r), Math.round(g), Math.round(b));
    }
    
    // Update blink effect for each snake
    private updateBlinkEffect(snakeId: string) {
        const now = this.time.now;
        
        // Get or initialize timer for this snake
        let blinkTimer = this.blinkTimers.get(snakeId) || 0;
        
        // Check if currently blinking
        const isBlinking = this.isBlinking.get(snakeId) || false;
        
        if (isBlinking) {
            // Blink duration: 100ms
            if (now - blinkTimer > 100) {
                this.isBlinking.set(snakeId, false);
                // Set next blink time (random between 2-5 seconds)
                this.blinkTimers.set(snakeId, now + Phaser.Math.Between(2000, 5000));
            }
        } else {
            // Check if it's time to blink
            if (now > blinkTimer) {
                this.isBlinking.set(snakeId, true);
                this.blinkTimers.set(snakeId, now);
            }
        }
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
        
        // 🚀 PERFORMANCE: Use cached viewport bounds if available
        const cam = this.cameras.main;
        const currentCameraX = cam.scrollX;
        const currentCameraY = cam.scrollY;
        
        let viewLeft: number, viewRight: number, viewTop: number, viewBottom: number;
        
        // Use cached bounds if camera hasn't moved significantly
        if (this.cachedViewportBounds && 
            Math.abs(currentCameraX - this.cachedViewportBounds.cameraX) <= this.cameraMoveThreshold &&
            Math.abs(currentCameraY - this.cachedViewportBounds.cameraY) <= this.cameraMoveThreshold) {
            viewLeft = this.cachedViewportBounds.left;
            viewRight = this.cachedViewportBounds.right;
            viewTop = this.cachedViewportBounds.top;
            viewBottom = this.cachedViewportBounds.bottom;
        } else {
            // Recalculate bounds
            viewLeft = currentCameraX - this.viewportBuffer;
            viewRight = currentCameraX + cam.width + this.viewportBuffer;
            viewTop = currentCameraY - this.viewportBuffer;
            viewBottom = currentCameraY + cam.height + this.viewportBuffer;
            
            // Update cache
            this.cachedViewportBounds = {
                left: viewLeft,
                right: viewRight,
                top: viewTop,
                bottom: viewBottom,
                cameraX: currentCameraX,
                cameraY: currentCameraY
            };
        }
        
        // First, handle removed foods
        this.foods.forEach((foodSprite, foodId) => {
            if (!this.gameState.foods.has(foodId)) {
                // Kill all tweens to prevent memory leak
                this.stopFoodTweens(foodSprite);
                
                // Remove glow if it exists
                const glow = foodSprite.getData('glow');
                if (glow) {
                    this.tweens.killTweensOf(glow); // Also kill glow tweens
                    glow.destroy();
                }
                
                // Clear tween references
                foodSprite.setData('attractTween', null);
                foodSprite.setData('normalTween', null);
                foodSprite.setData('rotationTween', null);
                foodSprite.setData('isAttracting', false);
                
                foodSprite.destroy();
                this.foods.delete(foodId);
            }
        });
        
        // Then, add or update existing foods
        this.gameState.foods.forEach((foodData: any, foodId: string) => {
            // Add null/undefined check to prevent errors
            if (!foodData || !foodData.position) {
                console.warn(`Food ${foodId} has invalid data:`, foodData);
                return; // Skip this food
            }
            
            const { position, value } = foodData;
            
            // Make sure position has x and y properties
            if (position.x === undefined || position.y === undefined) {
                console.warn(`Food ${foodId} has invalid position:`, position);
                return; // Skip this food
            }
            
            // 🚀 PERFORMANCE: Viewport culling for foods
            const isInView = position.x >= viewLeft && position.x <= viewRight && 
                            position.y >= viewTop && position.y <= viewBottom;
            
            if (!this.foods.has(foodId)) {
                // Create new food sprite
                const foodSprite = this.createFoodSprite(foodId, position.x, position.y, value);
                this.foods.set(foodId, foodSprite);
                
                // Set visibility based on viewport
                foodSprite.setVisible(isInView);
            } else {
                // Update existing food sprite
                const foodSprite = this.foods.get(foodId);
                if (foodSprite) {
                    // 🚀 PERFORMANCE: Only update if in viewport
                    foodSprite.setVisible(isInView);
                    
                    if (isInView) {
                        // Apply the server position
                        foodSprite.setPosition(position.x, position.y);
                        const previousValue = foodSprite.getData('value');
                        if (previousValue !== value) {
                            this.applyFoodAppearance(foodSprite, value, value === 1);
                        } else {
                            foodSprite.setData('value', value);
                        }
                        
                        // Update glow position if it exists
                        const glow = foodSprite.getData('glow');
                        if (glow) {
                            glow.setPosition(position.x, position.y);
                        }
                        
                        // Update texture if value changed
                        if ((value > 1 && foodSprite.texture.key !== 'special-food') || 
                            (value === 1 && foodSprite.texture.key !== 'food')) {
                            foodSprite.setTexture(value > 1 ? 'special-food' : 'food');
                            
                            // Clean up existing glow if any (no longer creating new glows)
                            if (glow) {
                                glow.destroy();
                                foodSprite.setData('glow', null);
                            }
                            
                            // Update animations based on food type
                            const isSpecial = value > 1;
                            if (!isSpecial) {
                                foodSprite.setAngle(0);
                            }
                            this.startFoodIdleTweens(foodSprite, isSpecial);
                        }
                    }
                }
            }
        });
    }
    
    private getRandomFoodColor(): number {
        const index = Phaser.Math.Between(0, this.foodColorPalette.length - 1);
        return this.foodColorPalette[index];
    }

    private ensureFoodTextures(): void {
        this.foodColorPalette.forEach((color) => {
            this.getFoodTextureKey(color);
        });
    }

    private getFoodTextureKey(color: number): string {
        const existing = this.foodTextureKeys.get(color);
        if (existing) {
            return existing;
        }

        const colorHex = color.toString(16).padStart(6, '0');
        const key = `food-color-${colorHex}`;

        if (!this.textures.exists(key)) {
            const size = 12;
            const radius = size / 2 - 2;
            const graphics = this.add.graphics({ x: 0, y: 0 });
            graphics.setVisible(false);
            graphics.fillStyle(color, 1);
            graphics.fillCircle(size / 2, size / 2, radius);
            graphics.lineStyle(2, 0x000000, 0.8);
            graphics.strokeCircle(size / 2, size / 2, radius);
            graphics.generateTexture(key, size, size);
            graphics.destroy();
        }

        this.foodTextureKeys.set(color, key);
        return key;
    }

    private applyFoodAppearance(
        foodSprite: Phaser.GameObjects.Image,
        value: number,
        forceNewColor: boolean = false
    ): void {
        foodSprite.setData('value', value);

        const isSpecial = value > 1;

        if (isSpecial) {
            foodSprite.clearTint();
            foodSprite.setData('color', null);
            if (foodSprite.texture.key !== 'special-food') {
                foodSprite.setTexture('special-food');
            }
        } else {
            let color = foodSprite.getData('color') as number | null;
            if (!color || forceNewColor) {
                color = this.getRandomFoodColor();
                foodSprite.setData('color', color);
            }

            const textureKey = this.getFoodTextureKey(color);
            if (foodSprite.texture.key !== textureKey) {
                foodSprite.setTexture(textureKey);
            }
            foodSprite.clearTint();
        }

        this.startFoodIdleTweens(foodSprite, isSpecial);
    }

    // 🚀 PERFORMANCE: Reduced tweens - only special food has animation, normal food is static
    private startFoodIdleTweens(foodSprite: Phaser.GameObjects.Image, isSpecial: boolean): void {
        this.stopFoodTweens(foodSprite);
        foodSprite.setAlpha(1);
        foodSprite.setScale(1);
        foodSprite.setAngle(0);

        // 🚀 PERFORMANCE: Disable food animations when FPS is low
        if (!this.enableFoodAnimations) {
            return; // No animations at all
        }

        // Only apply animations to special food
        if (isSpecial) {
            // Scale + alpha animation for special food
            const scaleTween = this.tweens.add({
                targets: foodSprite,
                scale: { from: 1, to: 1.35 },
                alpha: { from: 1, to: 0.5 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 250)
            });
            foodSprite.setData('normalTween', scaleTween);

            // Rotation animation for special food
            const rotationTween = this.tweens.add({
                targets: foodSprite,
                angle: 360,
                duration: 3000,
                repeat: -1,
                ease: 'Linear'
            });
            foodSprite.setData('rotationTween', rotationTween);
        } else {
            // Normal food is completely static - no animations
            foodSprite.setData('normalTween', null);
            foodSprite.setData('rotationTween', null);
        }
    }

    // 🚀 PERFORMANCE: Simplified tween cleanup
    private stopFoodTweens(foodSprite: Phaser.GameObjects.Image): void {
        const normalTween = foodSprite.getData('normalTween') as Phaser.Tweens.Tween | null;
        if (normalTween) {
            normalTween.stop();
            this.tweens.remove(normalTween);
        }

        const rotationTween = foodSprite.getData('rotationTween') as Phaser.Tweens.Tween | null;
        if (rotationTween) {
            rotationTween.stop();
            this.tweens.remove(rotationTween);
        }

        foodSprite.setData('normalTween', null);
        foodSprite.setData('rotationTween', null);
    }
    
    private createFoodSprite(id: string, x: number, y: number, value: number): Phaser.GameObjects.Image {
        // Create food sprite with appropriate texture based on value
        const texture = value > 1 ? 'special-food' : 'food';
        const foodSprite = this.add.image(x, y, texture);
        
        // Set depth to ensure food appears below snakes
        foodSprite.setDepth(5);
        
        // Store the food value for reference
        this.applyFoodAppearance(foodSprite, value, value === 1);
        
        // ❌ REMOVED: Glow effect for cleaner appearance
        
        return foodSprite;
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

        const notification = this.createSharpText(
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
        
        // Update top 10 player entries (reuse cached objects)
        const topPlayers = players.slice(0, 10);
        const bgWidth = 240;
        
        // Update each cached entry
        for (let i = 0; i < 10; i++) {
            const entry = this.leaderboardEntries.get(i);
            if (!entry) continue;
            
            if (i < topPlayers.length) {
                // Show and update this entry
                const player = topPlayers[i];
            const isCurrentPlayer = player.id === this.playerId;
                const rowY = 75 + (i * 22);
            
                // Update row background for current player
                if (entry.rowBg) {
            if (isCurrentPlayer) {
                        entry.rowBg.clear();
                        entry.rowBg.fillStyle(0x1a5555, 0.5);
                        entry.rowBg.fillRoundedRect(-bgWidth/2 + 10, rowY - 10, bgWidth - 20, 20, 5);
                        entry.rowBg.setVisible(true);
                    } else {
                        entry.rowBg.setVisible(false);
                    }
            }
            
                // Update rank text and color
                let rankText = `${i + 1}`;
            let rankColor = '#ffffff';
            
                if (i === 0) {
                rankText = '🥇';
                    rankColor = '#ffd700';
                } else if (i === 1) {
                rankText = '🥈';
                    rankColor = '#c0c0c0';
                } else if (i === 2) {
                rankText = '🥉';
                    rankColor = '#cd7f32';
                }
                
                entry.rankText.setText(rankText);
                entry.rankText.setColor(rankColor);
                entry.rankText.setStyle({ fontStyle: isCurrentPlayer ? 'bold' : 'normal' });
                entry.rankText.setVisible(true);
            
                // Update color circle
                entry.colorCircle.clear();
                entry.colorCircle.fillStyle(parseInt(player.color.replace('#', '0x')), 1);
                entry.colorCircle.fillCircle(-bgWidth/2 + 55, rowY, 4);
                entry.colorCircle.setVisible(true);
                
                // Update name text
            const nameColor = isCurrentPlayer ? '#ffff00' : '#ffffff';
            const displayName = isCurrentPlayer ? `${player.name} (me)` : player.name;
            const nameText = displayName.length > 10 ? displayName.substr(0, 8) + '..' : displayName;
                entry.nameText.setText(nameText);
                entry.nameText.setColor(nameColor);
                entry.nameText.setStyle({ fontStyle: isCurrentPlayer ? 'bold' : 'normal' });
                entry.nameText.setVisible(true);
            
                // Update score text
                entry.scoreText.setText(`${player.score}`);
                entry.scoreText.setColor(nameColor);
                entry.scoreText.setStyle({ fontStyle: isCurrentPlayer ? 'bold' : 'normal' });
                entry.scoreText.setVisible(true);
            
                // Update kills text
                entry.killsText.setText(`${player.kills}`);
                entry.killsText.setColor(nameColor);
                entry.killsText.setStyle({ fontStyle: isCurrentPlayer ? 'bold' : 'normal' });
                entry.killsText.setVisible(true);
            } else {
                // Hide unused entries
                entry.rankText.setVisible(false);
                entry.colorCircle.setVisible(false);
                entry.nameText.setVisible(false);
                entry.scoreText.setVisible(false);
                entry.killsText.setVisible(false);
                if (entry.rowBg) {
                    entry.rowBg.setVisible(false);
                }
            }
        }
        
        // Update player's rank in stats panel
        const currentPlayerIndex = players.findIndex(p => p.id === this.playerId);
        if (currentPlayerIndex !== -1) {
            if (this.playerRankText) {
                this.playerRankText.setText(`Rank: ${currentPlayerIndex + 1}/${players.length}`);
            }
        }
    }
    
    // 🚀 PERFORMANCE: Optimized leaderboard update with change detection
    private updateLeaderboardOptimized() {
        const room = this.room;
        const playersMap = room?.state?.players;
        if (!room || !playersMap) return;
        
        // Create a lightweight hash of top players to detect changes
        const players: any[] = [];
        playersMap.forEach((player: Player, sessionId: string) => {
            players.push({
                id: sessionId,
                score: player.score,
                kills: player.kills || 0
            });
        });
        
        players.sort((a, b) => b.score - a.score);
        const topPlayers = players.slice(0, 10);
        
        // Create hash from top 10 players data
        const currentHash = topPlayers
            .map(p => `${p.id}:${p.score}:${p.kills}`)
            .join('|');
        
        // Only update if there's a change
        if (currentHash !== this.lastLeaderboardHash) {
            this.lastLeaderboardHash = currentHash;
            this.updateLeaderboard();
        }
    }
    
    private updateMinimap() {
        if (!this.gameState) return;
        
        // 🚀 PERFORMANCE: Skip minimap update if not visible or game is paused
        if (!this.minimap || !this.minimap.visible) return;
        
        // Clear the minimap
        this.minimap.clear();
        
        // Draw the world border
        this.minimap.lineStyle(1, 0xFFFFFF, 0.5);
        this.minimap.strokeRect(0, 0, 150, 150);
        
        // Calculate scale factors once
        const scaleX = 150 / this.worldWidth;
        const scaleY = 150 / this.worldHeight;
        
        // 🚀 PERFORMANCE: Batch draw operations
        const playerDots: Array<{x: number, y: number, color: number, size: number}> = [];
        const foodDots: Array<{x: number, y: number, color: number}> = [];
        
        // Collect player positions
        this.gameState.players.forEach((player: any) => {
            if (!player.alive || !player.headPosition) return;
            
            const headPosition = player.headPosition;
            const minimapX = headPosition.x * scaleX;
            const minimapY = headPosition.y * scaleY;
            const isCurrentPlayer = player.id === this.playerId;
            
            playerDots.push({
                x: minimapX,
                y: minimapY,
                color: isCurrentPlayer ? 0xFFFF00 : 0xFFFFFF,
                size: isCurrentPlayer ? 4 : 2
            });
        });
        
        // Collect food positions (limit to visible foods for performance)
        let foodCount = 0;
        const maxFoodsOnMinimap = 250; // Limit foods on minimap
        this.foods.forEach((food) => {
            if (foodCount >= maxFoodsOnMinimap) return;
            const minimapX = food.x * scaleX;
            const minimapY = food.y * scaleY;
            const isSpecialFood = food.getData('value') > 1;
            
            foodDots.push({
                x: minimapX,
                y: minimapY,
                color: isSpecialFood ? 0xFF00FF : 0x00FF00
            });
            foodCount++;
        });
        
        // Batch draw players
        playerDots.forEach(dot => {
            this.minimap.fillStyle(dot.color, 1);
            this.minimap.fillCircle(dot.x, dot.y, dot.size);
        });
        
        // Batch draw foods
        foodDots.forEach(dot => {
            this.minimap.fillStyle(dot.color, 0.7);
            this.minimap.fillCircle(dot.x, dot.y, 1);
        });
    }
    
    private handlePlayerDeath() {
        // 🚀 PERFORMANCE: Only log in development
        if (process.env.NODE_ENV === 'development') {
            console.log('[GameScene] [handlePlayerDeath] Called');
        }
        
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
        if (this.respawnButton) {
            this.respawnButton.setVisible(true);
        }
        if (this.menuButton) {
            this.menuButton.setVisible(true);
        }
        
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
                
                const newScoreText = this.createSharpText(width/2, height/2, `Score: ${player.score}`, {
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
            const cameraDistance = Phaser.Math.Distance.Between(currentX, currentY, this.targetCameraX, this.targetCameraY);
            const distanceBoost = cameraDistance > this.cameraCatchupDistance
                ? Math.min((cameraDistance - this.cameraCatchupDistance) / this.cameraCatchupDistance, 1) * this.cameraCatchupBoost
                : 0;
            
            let lerpFactor = Phaser.Math.Clamp(
                this.cameraLerpFactor + distanceBoost,
                this.cameraLerpFactor,
                this.cameraLerpMax
            );
            
            if (player.boosting) {
                lerpFactor = Math.min(lerpFactor * 1.2, this.cameraLerpMax);
            }
            
            // Calculate interpolated position
            const newX = currentX + (this.targetCameraX - currentX) * lerpFactor;
            const newY = currentY + (this.targetCameraY - currentY) * lerpFactor;
            
            // Center camera on interpolated position
            this.cameras.main.centerOn(newX, newY);
        }
    }
    
    
    private setupAudio() {
        // 🚀 MOBILE OPTIMIZATION: Lazy load sounds
        // Set up essential sound effects (already loaded)
        this.eatSound = this.sound.add('eat');
        this.deathSound = this.sound.add('death');
        
        // 🚀 MOBILE OPTIMIZATION: Reuse eat sound for boost (no need to load separately)
        this.boostSound = this.eatSound; // Reuse eat sound
        
        // 🚀 MOBILE OPTIMIZATION: Lazy load background music only if available and on desktop
        const isMobile = this.isMobileDevice();
        if (!isMobile && this.cache.audio.exists('background')) {
            this.backgroundMusic = this.sound.add('background', {
                volume: 0.3,
                loop: true
            });
            // Don't auto-play on mobile to save bandwidth and battery
            this.backgroundMusic.play();
        } else {
            // Create a dummy sound object for mobile
            this.backgroundMusic = {
                play: () => {},
                stop: () => {},
                pause: () => {},
                resume: () => {},
                isPlaying: false,
                destroy: () => {}
            } as any;
        }
    }
    
    // 🚀 MOBILE OPTIMIZATION: Detect mobile device
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
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

        if (this.headAttractionAura) {
            this.headAttractionAura.destroy();
            this.headAttractionAura = undefined;
        }
    }
    
    private updateHeadAttractionAura(x: number, y: number) {
        if (!this.headAttractionAura) {
            this.headAttractionAura = this.add.graphics();
            this.headAttractionAura.setDepth(18);
        }

        const aura = this.headAttractionAura;
        aura.setVisible(true);
        aura.setPosition(x, y);
        aura.clear();
        aura.setBlendMode(Phaser.BlendModes.MULTIPLY);
        const steps = 5;
        const baseOpacity = 0.06;
        for (let index = 0; index < steps; index += 1) {
            const t = index / (steps - 1);
            const opacityDecay = (steps - index - 1);
            const opacity = baseOpacity * Math.max(opacityDecay, 0) / (steps - 1);
            const radius = this.headAuraRadius * (0.4 + 0.6 * t);
            aura.fillStyle(0x000000, opacity);
            aura.fillCircle(0, 0, radius);
        }
    }

    private resetFoodAttractionVisual(foodSprite: Phaser.GameObjects.Image) {
        const currentValue = (foodSprite.getData('value') as number) ?? 1;
        if (foodSprite.data && foodSprite.data.get('isAttracting')) {
            foodSprite.setData('isAttracting', false);
        }

        const attractTween = foodSprite.getData('attractTween') as Phaser.Tweens.Tween | null;
        if (attractTween) {
            attractTween.stop();
            this.tweens.remove(attractTween);
            foodSprite.setData('attractTween', null);
        }

        this.stopFoodTweens(foodSprite);
        foodSprite.setAlpha(1);
        foodSprite.setScale(1);

        this.startFoodIdleTweens(foodSprite, currentValue > 1);
    }
    
    // Update the attractFoodInFront method to handle glow cleanup when food is eaten
    private attractFoodInFront(headX: number, headY: number, angleDeg: number) {
        if (!this.gameState || !this.foods) return;
        
        const player = this.gameState.players.get(this.playerId);
        if (!player || !player.alive) return;
        
        // Convert angle to radians
        const angleRad = Phaser.Math.DegToRad(angleDeg);
        
        // Define the attraction parameters
        // 🚀 PERFORMANCE: Reduce attraction strength when FPS is low, but keep it functional for gameplay
        const baseAttractionStrength = 5;
        const attractionStrengthMultiplier = this.currentFPS < 30 ? 0.7 : (this.currentFPS < 40 ? 0.85 : 1.0);
        
        const attractionDistance = 153; // Phạm vi hút mồi phía trước (giảm 15%)
        const attractionConeAngle = Math.PI / 2.5; // Mở rộng góc hút (khoảng 72 độ)
        const attractionStrength = baseAttractionStrength * attractionStrengthMultiplier; // Reduced strength when FPS is low
        const eatDistance = 45; // Khoảng cách để tự động ăn thức ăn
        const headAuraRadius = this.headAuraRadius;
        
        // 🔥 PERFORMANCE: Pre-calculate squared distance to avoid expensive sqrt
        const maxDistanceSquared = attractionDistance * attractionDistance;
        const headAuraRadiusSquared = headAuraRadius * headAuraRadius;
        
        // Check each food item
        this.foods.forEach((foodSprite, foodId) => {
            const dx = foodSprite.x - headX;
            const dy = foodSprite.y - headY;
            const distanceSquared = dx * dx + dy * dy;
            const withinAura = distanceSquared <= headAuraRadiusSquared;
            
            if (!withinAura && distanceSquared > maxDistanceSquared) {
                this.resetFoodAttractionVisual(foodSprite);
                return;
            }
            
            const distance = Math.sqrt(distanceSquared);
            const foodAngle = Math.atan2(dy, dx);
            
            let angleDiff = Math.abs(foodAngle - angleRad);
            if (angleDiff > Math.PI) {
                angleDiff = 2 * Math.PI - angleDiff;
            }
            
            const withinCone = angleDiff <= attractionConeAngle / 2;
            if (!withinAura && !withinCone) {
                this.resetFoodAttractionVisual(foodSprite);
                return;
            }

            const alignmentFactor = withinAura ? 1 : 1 - (angleDiff / (attractionConeAngle / 2));
            const targetRange = withinAura ? headAuraRadius : attractionDistance;
            const distanceFactor = Phaser.Math.Clamp(1 - (distance / targetRange), 0, 1);
            const attractionForce = attractionStrength * Phaser.Math.Clamp(alignmentFactor, 0, 1) * distanceFactor;

            if (attractionForce <= 0) {
                this.resetFoodAttractionVisual(foodSprite);
                return;
            }
            
            const moveMultiplier = withinAura ? 0.15 : 0.1;
            const moveX = (headX - foodSprite.x) * attractionForce * moveMultiplier;
            const moveY = (headY - foodSprite.y) * attractionForce * moveMultiplier;
            
                foodSprite.x += moveX;
                foodSprite.y += moveY;
                
                const newDistance = Phaser.Math.Distance.Between(headX, headY, foodSprite.x, foodSprite.y);
                if (newDistance < eatDistance) {
                    // 🎯 Server-Authoritative: Only send message to server, let server validate
                    // Animation and effects will be triggered when receiving 'foodConsumed' event
                    const roomRef = this.room;
                    if (roomRef && !this.isQuitting) {
                        roomRef.send('eatFood', { 
                            foodId,
                            headX,
                            headY,
                            foodX: foodSprite.x,
                            foodY: foodSprite.y
                        });
                    }
                    
                    return;
                }
                
                if (!foodSprite.data || !foodSprite.data.get('isAttracting')) {
                    foodSprite.setData('isAttracting', true);
                    
                    // 🚀 PERFORMANCE: Only create attraction tween if food animations are enabled
                    if (this.enableFoodAnimations) {
                        const previousAttractTween = foodSprite.getData('attractTween') as Phaser.Tweens.Tween | null;
                        if (previousAttractTween) {
                            previousAttractTween.stop();
                            this.tweens.remove(previousAttractTween);
                        }

                        this.stopFoodTweens(foodSprite);
                        
                        const attractTween = this.tweens.add({
                            targets: foodSprite,
                            alpha: { from: 1, to: 0.7 },
                            scale: { from: 1, to: 1.5 },
                            duration: 200,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                        
                        foodSprite.setData('attractTween', attractTween);
                    }
                }
        });

    }
    
    // Update the addEatEffect method to show different values for special food
    private addEatEffect(x: number, y: number, value: number = 1) {
        // 🚀 PERFORMANCE: Skip visual effects if disabled
        if (!this.enableVisualEffects) {
            return;
        }
        
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
        
        // 🚀 PERFORMANCE: Only create particle burst if particle effects are enabled
        if (this.enableParticleEffects) {
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
        }
        
        // Add a score popup text (always show)
        const scoreText = this.createSharpText(x, y - 20, `+${value}`, {
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

        // 🔄 Segment count is now synced automatically from backend via totalLength
        // No need for manual score listener to update segments
        players.onAdd = (player: any, key: string) => {
            void player;
            void key;
            // Player added - segments will be synced in updateSnakes() via totalLength
        };
    }
    
    // Update the showKillNotification method with improved visuals
    private showKillNotification(killerSessionId: string, killedSessionId: string) {
        
        // Get player names or use session IDs if names aren't available
        const killerName = this.getPlayerName(killerSessionId) || `Player ${killerSessionId.substr(0, 4)}`;
        const killedName = this.getPlayerName(killedSessionId) || `Player ${killedSessionId.substr(0, 4)}`;
        
        
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
        const notificationText = this.createSharpText(
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
        const killerText = this.createSharpText(
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
        const eliminatedText = this.createSharpText(
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
        
        // Hide death overlay and buttons
        if (this.deathOverlay) this.deathOverlay.setVisible(false);
        if (this.respawnButton) this.respawnButton.setVisible(false);
        if (this.menuButton) this.menuButton.setVisible(false);
        
        // Set invulnerability for 3 seconds
        this.invulnerableUntil = this.time.now + 3000;
        
        // Send respawn message to server
        const room = this.room;
        if (room && !this.isQuitting) {
            room.send('respawn');
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
        const btnWidth = 120;
        const btnHeight = 48;
        const cornerRadius = 12;
        const shadowOffset = 6;
        const idleAlpha = 0.35;
        const hoverAlpha = 1;

        const buttonContainer = this.add.container(x, y).setDepth(1000).setScrollFactor(0);
        buttonContainer.setSize(btnWidth, btnHeight);

        const interactiveConfig: Phaser.Types.Input.InputConfiguration = {
            hitArea: new Phaser.Geom.Rectangle(0, 0, btnWidth, btnHeight),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true
        };
        buttonContainer.setInteractive(interactiveConfig);

        const shadow = this.add.graphics();
        const buttonBg = this.add.graphics();

        const drawButton = (state: 'default' | 'hover' | 'active' | 'disabled') => {
            const stateStyles: Record<typeof state, { fill: number; fillAlpha: number; stroke: number; strokeAlpha: number; shadowAlpha: number; shadowOffsetY: number; }> = {
                default: { fill: 0xff5a5a, fillAlpha: 0.92, stroke: 0xffffff, strokeAlpha: 0.85, shadowAlpha: 0.35, shadowOffsetY: shadowOffset },
                hover: { fill: 0xff6c6c, fillAlpha: 0.95, stroke: 0x0ec3c9, strokeAlpha: 0.95, shadowAlpha: 0.45, shadowOffsetY: shadowOffset + 1 },
                active: { fill: 0xff4141, fillAlpha: 0.98, stroke: 0x0ec3c9, strokeAlpha: 0.85, shadowAlpha: 0.3, shadowOffsetY: shadowOffset - 1 },
                disabled: { fill: 0xb35a5a, fillAlpha: 0.8, stroke: 0xffffff, strokeAlpha: 0.4, shadowAlpha: 0.2, shadowOffsetY: shadowOffset }
            };

            const style = stateStyles[state];

            shadow.clear();
            shadow.fillStyle(0x000000, style.shadowAlpha);
            shadow.fillRoundedRect(style.shadowOffsetY, style.shadowOffsetY, btnWidth, btnHeight, cornerRadius);

            buttonBg.clear();
            buttonBg.lineStyle(2, style.stroke, style.strokeAlpha);
            buttonBg.fillStyle(style.fill, style.fillAlpha);
            buttonBg.fillRoundedRect(0, 0, btnWidth, btnHeight, cornerRadius);
            buttonBg.strokeRoundedRect(0, 0, btnWidth, btnHeight, cornerRadius);
        };

        drawButton('default');
        buttonContainer.alpha = idleAlpha;

        const buttonText = this.createSharpText(btnWidth / 2, btnHeight / 2, '⏻ Quit', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        })
            .setOrigin(0.5, 0.5);

        buttonContainer.add([shadow, buttonBg, buttonText]);

        buttonContainer.on('pointerover', () => {
            drawButton('hover');
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 1.05,
                scaleY: 1.05,
                alpha: hoverAlpha,
                duration: 180,
                ease: 'Back.easeOut'
            });
        });
        
        buttonContainer.on('pointerout', () => {
            drawButton('default');
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 1,
                scaleY: 1,
                alpha: idleAlpha,
                duration: 180,
                ease: 'Back.easeIn'
            });
        });
        
        buttonContainer.on('pointerdown', () => {
            drawButton('active');
            buttonContainer.alpha = hoverAlpha;
            this.handleQuitClick(buttonContainer, buttonText, drawButton, interactiveConfig);
        });
    }
    
    private handleQuitClick(
        buttonContainer: Phaser.GameObjects.Container,
        buttonText: Phaser.GameObjects.Text,
        drawButton: (state: 'default' | 'hover' | 'active' | 'disabled') => void,
        interactiveConfig: Phaser.Types.Input.InputConfiguration
    ) {
        if (this.isQuitting) {
            return;
        }

        buttonContainer.disableInteractive();
        drawButton('disabled');
        buttonText.disableInteractive();

        this.tweens.add({
            targets: buttonContainer,
            alpha: 0.85,
            duration: 120,
            yoyo: true,
            onComplete: async () => {
                if (this.isQuitting) {
                    return;
                }

                try {
                    this.isQuitting = true;
                    buttonText.setText('Leaving...');
                    await this.leaveRoomSafely();
                    
                    // Emit event to return to React menu
                    EventBus.emit('game-exit');
                } catch (error) {
                    console.error('Error leaving room:', error);
                    this.isQuitting = false;
                    buttonText.setText('Retry?');
                    buttonContainer.setInteractive(interactiveConfig);
                    drawButton('default');
                    buttonText.setInteractive({ useHandCursor: true });
                    buttonContainer.alpha = 1;
                }
            }
        });
    }
    
    /**
     * Update wall warning display when player snake is near walls
     */
    private updateWallWarning(): void {
        if (!this.wallWarningGraphics || !this.gameState) {
            return;
        }
        
        const player = this.gameState.players.get(this.playerId);
        if (!player || !player.alive || !player.headPosition) {
            this.wallWarningGraphics.clear();
            return;
        }
        
        const headX = player.headPosition.x;
        const headY = player.headPosition.y;
        
        // Calculate distances to each wall
        const distToLeft = headX;
        const distToRight = this.worldWidth - headX;
        const distToTop = headY;
        const distToBottom = this.worldHeight - headY;
        
        // Find minimum distance to any wall
        const minDistance = Math.min(distToLeft, distToRight, distToTop, distToBottom);
        
        // Clear previous warning
        this.wallWarningGraphics.clear();
        
        // Only show warning if within warning distance
        if (minDistance > this.wallWarningDistance) {
            return;
        }
        
        // Calculate warning intensity (0 = far, 1 = very close)
        const warningIntensity = 1 - (minDistance / this.wallWarningDistance);
        
        // Get camera viewport
        const camera = this.cameras.main;
        const cameraWidth = camera.width;
        const cameraHeight = camera.height;
        
        // Determine which walls to highlight
        const showLeft = distToLeft <= this.wallWarningDistance;
        const showRight = distToRight <= this.wallWarningDistance;
        const showTop = distToTop <= this.wallWarningDistance;
        const showBottom = distToBottom <= this.wallWarningDistance;
        
        // Draw warning borders on screen edges
        const borderThickness = 8 + (warningIntensity * 12); // Thicker when closer
        const pulseTime = Date.now() / 200;
        
        // Left wall warning
        if (showLeft) {
            const leftIntensity = 1 - (distToLeft / this.wallWarningDistance);
            const leftAlpha = Math.max(0.3, Math.min(0.8, leftIntensity * 0.8));
            const leftColor = distToLeft <= this.wallDangerDistance ? 0xff0000 : 0xffaa00;
            // Add pulsing effect
            const pulseAlpha = leftAlpha * (0.7 + 0.3 * Math.sin(pulseTime));
            this.wallWarningGraphics.fillStyle(leftColor, pulseAlpha);
            this.wallWarningGraphics.fillRect(0, 0, borderThickness, cameraHeight);
        }
        
        // Right wall warning
        if (showRight) {
            const rightIntensity = 1 - (distToRight / this.wallWarningDistance);
            const rightAlpha = Math.max(0.3, Math.min(0.8, rightIntensity * 0.8));
            const rightColor = distToRight <= this.wallDangerDistance ? 0xff0000 : 0xffaa00;
            // Add pulsing effect
            const pulseAlpha = rightAlpha * (0.7 + 0.3 * Math.sin(pulseTime));
            this.wallWarningGraphics.fillStyle(rightColor, pulseAlpha);
            this.wallWarningGraphics.fillRect(cameraWidth - borderThickness, 0, borderThickness, cameraHeight);
        }
        
        // Top wall warning
        if (showTop) {
            const topIntensity = 1 - (distToTop / this.wallWarningDistance);
            const topAlpha = Math.max(0.3, Math.min(0.8, topIntensity * 0.8));
            const topColor = distToTop <= this.wallDangerDistance ? 0xff0000 : 0xffaa00;
            // Add pulsing effect
            const pulseAlpha = topAlpha * (0.7 + 0.3 * Math.sin(pulseTime));
            this.wallWarningGraphics.fillStyle(topColor, pulseAlpha);
            this.wallWarningGraphics.fillRect(0, 0, cameraWidth, borderThickness);
        }
        
        // Bottom wall warning
        if (showBottom) {
            const bottomIntensity = 1 - (distToBottom / this.wallWarningDistance);
            const bottomAlpha = Math.max(0.3, Math.min(0.8, bottomIntensity * 0.8));
            const bottomColor = distToBottom <= this.wallDangerDistance ? 0xff0000 : 0xffaa00;
            // Add pulsing effect
            const pulseAlpha = bottomAlpha * (0.7 + 0.3 * Math.sin(pulseTime));
            this.wallWarningGraphics.fillStyle(bottomColor, pulseAlpha);
            this.wallWarningGraphics.fillRect(0, cameraHeight - borderThickness, cameraWidth, borderThickness);
        }
    }
} 