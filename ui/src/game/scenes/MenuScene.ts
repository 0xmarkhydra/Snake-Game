import { Scene } from 'phaser';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, VaultSDK } from '@solana-payment/sdk';
import { EventBus } from '../EventBus';
import { GAME_INFO } from '../../configs/game';
import { authService } from '../../services/AuthService';
import { walletService } from '../../services/WalletService';
import { apiService } from '../../services/ApiService';
import { vipRoomService } from '../../services/VipRoomService';
import type { RoomType, VipAccessCheckResult } from '../../types/Game.types';
import type { PhantomProvider } from '../../types/Auth.types';

const DEFAULT_RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

interface DepositMetadata {
    raw: Record<string, unknown>;
    tokenMint: string;
    decimals: number;
    amount: number;
    memo?: string;
    referenceCode?: string;
}

interface MenuSceneData {
    isAuthenticated?: boolean;
}

export class MenuScene extends Scene {
    private playerName: string = 'Player';
    private selectedSkin: number = 0;
    private skins: number[] = [0, 1, 2, 3, 4, 5, 6, 7]; // Skin IDs
    private skinImages: Phaser.GameObjects.Image[] = [];
    private menuContainer?: Phaser.GameObjects.Container;
    private nameInputDom?: Phaser.GameObjects.DOMElement;
    private nameInputElement?: HTMLInputElement | null;
    private instructionsText?: Phaser.GameObjects.Text;
    private versionText?: Phaser.GameObjects.Text;
    private isAuthenticated: boolean = false;
    private creditText: Phaser.GameObjects.Text;
    private walletInfoContainer?: Phaser.GameObjects.Container;
    private connectPromptContainer?: Phaser.GameObjects.Container;

    private vipModalOverlay?: Phaser.GameObjects.Rectangle;
    private vipModalContainer?: Phaser.GameObjects.Container;
    private vipDomElement?: Phaser.GameObjects.DOMElement;
    private vipProcessing: boolean = false;
    private readonly rpcEndpoint: string = DEFAULT_RPC_ENDPOINT;
    private creditUpdateHandler?: () => void;
    
    constructor() {
        super('MenuScene');
    }
    
    init(data: MenuSceneData) {
        this.isAuthenticated = data.isAuthenticated || authService.isAuthenticated();
        
        // Load user profile if authenticated
        if (this.isAuthenticated) {
            const profile = authService.getUserProfile();
            if (profile && profile.displayName) {
                this.playerName = profile.displayName;
            }
            
            // Start polling credit
            walletService.startPolling(3000);
        }
    }
    
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Add animated background with gradient
        this.createAnimatedBackground(width, height);
        
        // Add decorative elements
        this.createDecorations(width, height);
        
        // Render wallet/connect controls
        this.renderWalletControls(width, height);
        
        
        // Create a container for the menu content
        const menuContainer = this.add.container(width / 2, height / 2);
        this.menuContainer = menuContainer;
        
        // Add title with animation
        this.createAnimatedTitle(menuContainer, 0, -height / 4);
        
        // Create panel for menu items with updated colors to match the theme
        const panel = this.add.rectangle(0, 0, width * 0.5, height * 0.7, 0x0a2463, 0.7)
            .setStrokeStyle(4, 0x3e92cc, 0.8)
            .setOrigin(0.5);
        
        // Add rounded corners to panel
        panel.setInteractive(new Phaser.Geom.Rectangle(-width * 0.25, -height * 0.35, width * 0.5, height * 0.7), Phaser.Geom.Rectangle.Contains);
        menuContainer.add(panel);
        
        // Update the skin selection label and underline colors
        const skinLabel = this.add.text(0, 10, 'CHOOSE YOUR SKIN', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        menuContainer.add(skinLabel);
        
        // Add underline to skin label with updated color
        const skinUnderline = this.add.graphics();
        skinUnderline.lineStyle(2, 0x3e92cc, 1);
        skinUnderline.lineBetween(-120, 25, 120, 25);
        menuContainer.add(skinUnderline);
        
        // Update the name label and underline colors
        const nameLabel = this.add.text(0, -120, 'YOUR NAME', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        menuContainer.add(nameLabel);
        
        // Add underline to label with updated color
        const underline = this.add.graphics();
        underline.lineStyle(2, 0x3e92cc, 1);
        underline.lineBetween(-80, -105, 80, -105);
        menuContainer.add(underline);
        
        // Create a DOM element for name input with better styling
        this.nameInputDom = this.add.dom(0, -80).createFromHTML(`
            <input type="text" id="nameInput" maxlength="15" placeholder="Enter your name" 
                   style="padding: 12px; width: 240px; text-align: center; border-radius: 8px; 
                   border: 2px solid #3e92cc; background-color: rgba(10,36,99,0.7); color: white; 
                   font-size: 18px; font-family: Arial; outline: none; box-shadow: 0 0 10px #3e92cc;">
        `);
        menuContainer.add(this.nameInputDom);
        this.nameInputElement = this.nameInputDom.node.querySelector('input');
        
        // Set default value
        setTimeout(() => {
            const inputElement = document.getElementById('nameInput') as HTMLInputElement;
            if (inputElement) {
                inputElement.value = this.playerName;
                inputElement.addEventListener('input', (e) => {
                    this.playerName = (e.target as HTMLInputElement).value;
                });
                
                // Add focus and blur effects with updated colors
                inputElement.addEventListener('focus', () => {
                    inputElement.style.boxShadow = '0 0 15px #5ca4d5';
                    inputElement.style.border = '2px solid #5ca4d5';
                });
                
                inputElement.addEventListener('blur', () => {
                    inputElement.style.boxShadow = '0 0 10px #3e92cc';
                    inputElement.style.border = '2px solid #3e92cc';
                });
            }
        }, 100);
        
        // Add skin selection with improved visuals
        this.createEnhancedSkinSelection(menuContainer, 0, 70);
        
        // Add play buttons (Free and VIP)
        this.createPlayButtons(menuContainer);
        
        // Instructions with better styling
        this.instructionsText = this.add.text(width / 2, height - 40, 'Use mouse to control direction. Click to boost. Eat food to grow. Avoid other snakes!', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            wordWrap: { width: width * 0.6 }
        }).setOrigin(0.5);
        
        // Add version info
        this.versionText = this.add.text(width - 10, height - 10, `v${GAME_INFO.version}`, {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#aaaaaa'
        }).setOrigin(1);
        
        // Animate menu container entrance
        menuContainer.setAlpha(0);
        menuContainer.setScale(0.8);
        this.tweens.add({
            targets: menuContainer,
            alpha: 1,
            scale: 1,
            duration: 800,
            ease: 'Back.easeOut',
            delay: 300
        });
        
        // Notify that the scene is ready
        EventBus.emit('current-scene-ready', this);
    }
    
    private createAnimatedBackground(width: number, height: number) {
        // Add background with gradient similar to LoadingScene
        const bg = this.add.graphics();
        bg.fillGradientStyle(
            0x0a2463, 0x0a2463,  // Dark blue at top (same as LoadingScene)
            0x3e92cc, 0x3e92cc,  // Light blue at bottom (same as LoadingScene)
            1, 1, 1, 1
        );
        bg.fillRect(0, 0, width, height);
        
        // Add grid pattern similar to LoadingScene
        this.add.grid(
            width / 2, height / 2,
            width, height,
            32, 32,  // Same grid size as LoadingScene
            undefined, undefined,
            0xffffff, 0.1  // Same color and alpha as LoadingScene
        );
        
        // Add particles for background with colors that match the new theme
        if (this.textures.exists('food')) {
            // Create particle emitters using the correct API
            this.add.particles(0, 0, 'food', {
                x: { min: 0, max: width },
                y: { min: 0, max: height },
                scale: { start: 0.2, end: 0.1 },
                alpha: { start: 0.3, end: 0 },
                speed: 20,
                angle: { min: 0, max: 360 },
                rotate: { min: 0, max: 360 },
                lifespan: { min: 10000, max: 15000 },
                frequency: 500,
                blendMode: 'ADD',
                tint: [0x3e92cc, 0x5ca4d5, 0x0a2463]  // Colors that match the gradient
            });
            
            // Add floating food particles
            this.add.particles(0, 0, 'food', {
                x: { min: 0, max: width },
                y: height + 50,
                scale: { start: 0.5, end: 0.2 },
                alpha: { start: 0.6, end: 0 },
                speed: { min: 50, max: 100 },
                angle: { min: 260, max: 280 },
                rotate: { min: 0, max: 360 },
                lifespan: { min: 10000, max: 15000 },
                frequency: 2000,
                blendMode: 'NORMAL',
                tint: [0xffffff, 0x3e92cc, 0x5ca4d5]  // Colors that match the gradient
            });
        }
    }
    
    private createDecorations(width: number, height: number) {
        // Add decorative snake silhouettes in the background
        if (this.textures.exists('snake-body')) {
            // Create a few snake silhouettes
            for (let i = 0; i < 3; i++) {
                const x = Phaser.Math.Between(100, width - 100);
                const y = Phaser.Math.Between(100, height - 100);
                const segments = Phaser.Math.Between(5, 10);
                
                // Create a snake silhouette with colors that match the theme
                this.createSnakeSilhouette(x, y, segments, 0x5ca4d5, 0.2);  // Lighter blue that matches the gradient
            }
        }
    }
    
    private createSnakeSilhouette(x: number, y: number, segments: number, color: number, alpha: number) {
        // Create a container for the snake
        const snake = this.add.container(x, y);
        
        // Create segments
        for (let i = 0; i < segments; i++) {
            const segment = this.add.image(i * -20, 0, 'snake-body')
                .setTint(color)
                .setAlpha(alpha)
                .setScale(1.5);
            snake.add(segment);
        }
        
        // Add head
        const head = this.add.image(20, 0, 'snake-head')
            .setTint(color)
            .setAlpha(alpha)
            .setScale(1.5);
        snake.add(head);
        
        // Animate the snake
        this.tweens.add({
            targets: snake,
            x: x + Phaser.Math.Between(-200, 200),
            y: y + Phaser.Math.Between(-200, 200),
            duration: Phaser.Math.Between(15000, 25000),
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Rotate the snake
        this.tweens.add({
            targets: snake,
            angle: Phaser.Math.Between(-30, 30),
            duration: Phaser.Math.Between(8000, 12000),
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }
    
    private createAnimatedTitle(container: Phaser.GameObjects.Container, x: number, y: number) {
        // Create title text with shadow
        const titleShadow = this.add.text(x + 4, y + 4, GAME_INFO.name, {
            fontFamily: 'Arial',
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#000000',
            align: 'center'
        }).setOrigin(0.5);
        
        const title = this.add.text(x, y, GAME_INFO.name, {
            fontFamily: 'Arial',
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Add glow effect
        const titleGlow = this.add.text(x, y, GAME_INFO.name, {
            fontFamily: 'Arial',
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#3333ff',
            align: 'center'
        }).setOrigin(0.5).setBlendMode('ADD').setAlpha(0.5);
        
        container.add(titleShadow);
        container.add(title);
        container.add(titleGlow);
        
        // Add subtitle
        const subtitle = this.add.text(x, y + 70, 'Multiplayer Snake Game', {
            fontFamily: 'Arial',
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        container.add(subtitle);
        
        // Animate title
        this.tweens.add({
            targets: [title, titleShadow, titleGlow],
            y: y - 10,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Animate glow
        this.tweens.add({
            targets: titleGlow,
            alpha: 0.8,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }
    
    private createEnhancedSkinSelection(container: Phaser.GameObjects.Container, x: number, y: number) {
        // Calculate grid layout
        const itemsPerRow = Math.ceil(this.skins.length / 2); // Split into 2 rows
        const spacing = Math.min(75, 400 / itemsPerRow); // Adjust spacing for grid layout
        
        // Create a container for the skin grid
        const skinContainer = this.add.container(x, y);
        container.add(skinContainer);
        
        // Store references to all skin containers for easier updates
        const skinItemContainers: Phaser.GameObjects.Container[] = [];
        
        // Create skin selection boxes in a grid layout
        for (let i = 0; i < this.skins.length; i++) {
            // Calculate grid position (row, column)
            const row = Math.floor(i / itemsPerRow);
            const col = i % itemsPerRow;
            
            // Calculate x and y position in the grid
            const skinX = (col - (itemsPerRow - 1) / 2) * spacing;
            const skinY = row * 100; // Increase from 80 to 100 pixels between rows
            
            // Create a container for the skin
            const skinItemContainer = this.add.container(skinX, skinY);
            skinContainer.add(skinItemContainer);
            skinItemContainers.push(skinItemContainer);
            
            // Make skin boxes slightly larger for better visibility
            const boxSize = Math.min(55, 350 / itemsPerRow);
            const halfBox = boxSize / 2;
            
            // Update the skin selection background colors
            const bgGraphics = this.add.graphics();
            bgGraphics.fillGradientStyle(
                0x0a2463, 0x0a2463,  // Dark blue at top (matching background)
                0x0a3473, 0x0a3473,  // Slightly lighter blue at bottom
                1, 1, 1, 1
            );
            bgGraphics.fillRoundedRect(-halfBox, -halfBox, boxSize, boxSize, 10);
            bgGraphics.lineStyle(2, 0x3e92cc, 0.8);
            bgGraphics.strokeRoundedRect(-halfBox, -halfBox, boxSize, boxSize, 10);
            
            // Update interactive area to match new size
            bgGraphics.setInteractive(new Phaser.Geom.Rectangle(-halfBox, -halfBox, boxSize, boxSize), Phaser.Geom.Rectangle.Contains);
            skinItemContainer.add(bgGraphics);
            
            // Add snake head image (scaled to fit)
            const skinImage = this.add.image(0, 0, 'snake-head')
                .setTint(this.getSkinColor(this.skins[i]))
                .setScale(boxSize / 60);
            skinItemContainer.add(skinImage);
            this.skinImages.push(skinImage);
            
            // Selection indicator (slightly larger than the box)
            const selectionIndicator = this.add.graphics();
            selectionIndicator.lineStyle(3, 0xffff00, i === this.selectedSkin ? 1 : 0);
            selectionIndicator.strokeRoundedRect(-(halfBox+5), -(halfBox+5), boxSize+10, boxSize+10, 12);
            selectionIndicator.setName(`selection_${i}`);
            skinItemContainer.add(selectionIndicator);
            
            // Add glow effect for selected skin
            const glowGraphics = this.add.graphics();
            glowGraphics.fillStyle(0xffff00, 0.3);
            glowGraphics.fillRoundedRect(-(halfBox+5), -(halfBox+5), boxSize+10, boxSize+10, 12);
            glowGraphics.setAlpha(i === this.selectedSkin ? 1 : 0);
            glowGraphics.setName(`glow_${i}`);
            skinItemContainer.add(glowGraphics);
            
            // Set initial scale for selected skin
            if (i === this.selectedSkin) {
                skinItemContainer.setScale(1.2);
                
                // Add pulsing animation to selected skin
                this.tweens.add({
                    targets: glowGraphics,
                    alpha: { from: 0.3, to: 0.7 },
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });
            }
            
            // Handle click with animation
            bgGraphics.on('pointerdown', () => {
                // Skip if already selected
                if (this.selectedSkin === i) return;
                
                // Update selected skin
                const previousSkin = this.selectedSkin;
                this.selectedSkin = i;
                
                // Play sound effect
                if (this.sound.get('select')) {
                    this.sound.play('select', { volume: 0.3 });
                }
                
                // Update the previously selected skin
                if (previousSkin >= 0 && previousSkin < skinItemContainers.length) {
                    const prevContainer = skinItemContainers[previousSkin];
                    const prevGlow = prevContainer.getByName(`glow_${previousSkin}`) as Phaser.GameObjects.Graphics;
                    const prevIndicator = prevContainer.getByName(`selection_${previousSkin}`) as Phaser.GameObjects.Graphics;
                    
                    // Stop any existing tweens
                    this.tweens.killTweensOf(prevGlow);
                    
                    // Update indicator
                    if (prevIndicator) {
                        prevIndicator.clear();
                        prevIndicator.lineStyle(3, 0xffff00, 0);
                        prevIndicator.strokeRoundedRect(-(halfBox+5), -(halfBox+5), boxSize+10, boxSize+10, 12);
                    }
                    
                    // Update glow
                    if (prevGlow) {
                        this.tweens.add({
                            targets: prevGlow,
                            alpha: 0,
                            duration: 200
                        });
                    }
                    
                    // Scale down previous selection
                    this.tweens.add({
                        targets: prevContainer,
                        scale: 1,
                        duration: 200,
                        ease: 'Back.easeIn'
                    });
                }
                
                // Update the newly selected skin
                const newContainer = skinItemContainers[i];
                const newGlow = newContainer.getByName(`glow_${i}`) as Phaser.GameObjects.Graphics;
                const newIndicator = newContainer.getByName(`selection_${i}`) as Phaser.GameObjects.Graphics;
                
                // Update indicator
                if (newIndicator) {
                    newIndicator.clear();
                    newIndicator.lineStyle(3, 0xffff00, 1);
                    newIndicator.strokeRoundedRect(-(halfBox+5), -(halfBox+5), boxSize+10, boxSize+10, 12);
                }
                
                // Update glow
                if (newGlow) {
                    this.tweens.add({
                        targets: newGlow,
                        alpha: 0.3,
                        duration: 200,
                        onComplete: () => {
                            // Add pulsing animation to selected skin
                            this.tweens.add({
                                targets: newGlow,
                                alpha: { from: 0.3, to: 0.7 },
                                duration: 800,
                                yoyo: true,
                                repeat: -1
                            });
                        }
                    });
                }
                
                // Scale up new selection
                this.tweens.add({
                    targets: newContainer,
                    scale: 1.2,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            });
            
            // Add hover effects
            bgGraphics.on('pointerover', () => {
                if (i !== this.selectedSkin) {
                    this.tweens.add({
                        targets: skinItemContainer,
                        scale: 1.1,
                        duration: 200,
                        ease: 'Back.easeOut'
                    });
                }
            });
            
            bgGraphics.on('pointerout', () => {
                if (i !== this.selectedSkin) {
                    this.tweens.add({
                        targets: skinItemContainer,
                        scale: 1,
                        duration: 200,
                        ease: 'Back.easeIn'
                    });
                }
            });
        }
    }
    
    private getSkinColor(skinId: number): number {
        // Return different colors based on skin ID - match with server colors
        const colors = [
            0xFF5733, // Orange (skin 0)
            0x33FF57, // Green (skin 1)
            0x3357FF, // Blue (skin 2)
            0xF3FF33, // Yellow (skin 3)
            0xFF33F3, // Pink (skin 4)
            0x33FFF3, // Cyan (skin 5)
            0x9933FF, // Purple (skin 6)
            0xFF3333  // Red (skin 7)
        ];
        return colors[skinId % colors.length];
    }
    
    private setMenuVisibility(visible: boolean): void {
        this.menuContainer?.setVisible(visible);
        this.instructionsText?.setVisible(visible);
        this.versionText?.setVisible(visible);

        if (this.nameInputDom) {
            this.nameInputDom.setVisible(visible);
            const domNode = this.nameInputDom.node as HTMLElement;
            if (domNode) {
                domNode.style.display = visible ? 'block' : 'none';
            }
        }

        if (this.nameInputElement) {
            this.nameInputElement.style.visibility = visible ? 'visible' : 'hidden';
            if (!visible) {
                this.nameInputElement.blur();
            }
        }
    }

    private renderWalletControls(width: number, height: number): void {
        if (authService.isAuthenticated()) {
            this.isAuthenticated = true;
            this.createWalletInfo(width, height);
        } else {
            this.isAuthenticated = false;
            this.createConnectPrompt(width, height);
        }
    }

    private destroyConnectPrompt(): void {
        if (this.connectPromptContainer) {
            this.connectPromptContainer.destroy();
            this.connectPromptContainer = undefined;
        }
    }

    private createConnectPrompt(width: number, _height: number): void {
        this.destroyConnectPrompt();
        if (this.walletInfoContainer) {
            this.walletInfoContainer.destroy();
            this.walletInfoContainer = undefined;
        }

        const container = this.add.container(width - 20, 20)
            .setScrollFactor(0)
            .setDepth(1000);

        const panelWidth = 260;
        const panelHeight = 120;
        const panelBg = this.add.graphics();
        panelBg.fillGradientStyle(0x0d1828, 0x0d1828, 0x081020, 0x081020, 0.95, 0.95, 0.95, 0.95);
        panelBg.fillRoundedRect(-panelWidth, 0, panelWidth, panelHeight, 10);
        panelBg.lineStyle(2, 0x3e92cc, 0.8);
        panelBg.strokeRoundedRect(-panelWidth, 0, panelWidth, panelHeight, 10);
        container.add(panelBg);

        const promptText = this.add.text(-panelWidth + 15, 15, 'Chưa kết nối Phantom', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        container.add(promptText);

        const subText = this.add.text(-panelWidth + 15, 40, 'Đăng nhập để mở khóa phòng VIP và nạp credit ngay trong game.', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#9ad6ff',
            wordWrap: { width: panelWidth - 30 }
        });
        container.add(subText);

        const buttonWidth = panelWidth - 30;
        const buttonHeight = 40;
        const buttonX = -panelWidth + 15;
        const buttonY = 70;

        const buttonBg = this.add.graphics();
        buttonBg.fillGradientStyle(0xff9500, 0xffb347, 0xff7a00, 0xff9500, 1, 1, 1, 1);
        buttonBg.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
        buttonBg.lineStyle(2, 0xffffff, 0.9);
        buttonBg.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
        buttonBg.setInteractive(new Phaser.Geom.Rectangle(buttonX, buttonY, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
        container.add(buttonBg);

        const buttonLabel = this.add.text(
            buttonX + buttonWidth / 2,
            buttonY + buttonHeight / 2,
            'Kết nối Phantom',
            {
                fontFamily: 'Arial',
                fontSize: '15px',
                fontStyle: 'bold',
                color: '#ffffff'
            }
        ).setOrigin(0.5);
        container.add(buttonLabel);

        buttonBg.on('pointerover', () => {
            this.tweens.add({
                targets: container,
                scale: 1.03,
                duration: 150,
                ease: 'Back.easeOut'
            });
        });

        buttonBg.on('pointerout', () => {
            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 150,
                ease: 'Back.easeIn'
            });
        });

        buttonBg.on('pointerdown', () => {
            this.tweens.add({
                targets: container,
                scale: 0.97,
                duration: 100,
                yoyo: true,
                onComplete: () => this.showVipLoginModal()
            });
        });

        this.connectPromptContainer = container;
    }

    private createWalletInfo(width: number, _height: number) {
        this.destroyConnectPrompt();
        if (this.walletInfoContainer) {
            this.walletInfoContainer.destroy();
            this.walletInfoContainer = undefined;
        }

        if (this.creditUpdateHandler) {
            this.events.off('update', this.creditUpdateHandler);
            this.creditUpdateHandler = undefined;
        }

        // Create wallet info container at top right
        const walletContainer = this.add.container(width - 20, 20)
            .setScrollFactor(0)
            .setDepth(1000);
        
        // Background panel
        const panelWidth = 280;
        const panelHeight = 120;
        const panelBg = this.add.graphics();
        panelBg.fillGradientStyle(
            0x0d2828, 0x0d2828,
            0x081818, 0x081818,
            0.95, 0.95, 0.95, 0.95
        );
        panelBg.fillRoundedRect(-panelWidth, 0, panelWidth, panelHeight, 10);
        panelBg.lineStyle(2, 0x3e92cc, 0.8);
        panelBg.strokeRoundedRect(-panelWidth, 0, panelWidth, panelHeight, 10);
        walletContainer.add(panelBg);
        
        // Wallet address
        const walletAddress = authService.getWalletAddress();
        if (walletAddress) {
            const walletText = this.add.text(-panelWidth + 15, 15, '🔗 ' + authService.formatWalletAddress(walletAddress), {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#ffffff',
                fontStyle: 'bold'
            });
            walletContainer.add(walletText);
        }
        
        // Credit display
        const creditLabel = this.add.text(-panelWidth + 15, 45, '💎 Credit:', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#aaaaaa'
        });
        walletContainer.add(creditLabel);
        
        this.creditText = this.add.text(-panelWidth + 90, 45, walletService.formatCredit(), {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        walletContainer.add(this.creditText);
        
        // Update credit every frame
        this.creditUpdateHandler = () => {
            if (this.creditText && this.creditText.active) {
                this.creditText.setText(walletService.formatCredit());
            }
        };
        this.events.on('update', this.creditUpdateHandler);
        
        // Logout button
        const logoutBtn = this.add.text(-panelWidth + 15, 75, '🚪 Logout', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ff6666',
            fontStyle: 'bold'
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            logoutBtn.setColor('#ff0000');
            logoutBtn.setScale(1.1);
        })
        .on('pointerout', () => {
            logoutBtn.setColor('#ff6666');
            logoutBtn.setScale(1);
        })
        .on('pointerdown', async () => {
            walletService.stopPolling();
            await authService.logout();
            walletService.clearCredit();
            this.isAuthenticated = false;
            if (this.creditUpdateHandler) {
                this.events.off('update', this.creditUpdateHandler);
                this.creditUpdateHandler = undefined;
            }
            this.scene.restart({ isAuthenticated: false });
        });
        walletContainer.add(logoutBtn);
        
        // Animate entrance
        walletContainer.setAlpha(0);
        walletContainer.setX(width + 50);
        this.tweens.add({
            targets: walletContainer,
            alpha: 1,
            x: width - 20,
            duration: 500,
            ease: 'Back.easeOut',
            delay: 500
        });

        this.walletInfoContainer = walletContainer;
    }
    
    private createPlayButtons(container: Phaser.GameObjects.Container) {
        // Free button (left)
        const freeButton = this.createGameButton(
            -130, 250,
            'PLAY FREE',
            0x4CAF50, // Green
            () => this.startGame('free')
        );
        container.add(freeButton);
        
        // VIP button (right)
        const vipButton = this.createGameButton(
            130, 250,
            'PLAY VIP',
            0xFF9500, // Orange/Gold
            () => this.handleVipPlay()
        );
        container.add(vipButton);
        
            const vipInfo = this.add.text(130, 320, '', {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffaa00',
                align: 'center'
            }).setOrigin(0.5);
            container.add(vipInfo);
            
        const updateVipInfo = () => {
            if (authService.isAuthenticated()) {
                const hasCredit = walletService.hasEnoughCredit(1);
                if (hasCredit) {
                    vipInfo.setText('Ready to play VIP!');
                    vipInfo.setColor('#9ad6ff');
                } else {
                    vipInfo.setText('Cần ≥1 credit – nhấn để nạp');
                    vipInfo.setColor('#ffaa00');
                }
            } else {
                vipInfo.setText('🔒 Login to play VIP ');
                vipInfo.setColor('#ff6666');
            }
        };

        this.events.on('update', updateVipInfo);

        const clearVipInfoListener = () => {
            this.events.off('update', updateVipInfo);
            if (vipInfo.active) {
                vipInfo.destroy();
            }
        };

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, clearVipInfoListener);
        this.events.once(Phaser.Scenes.Events.DESTROY, clearVipInfoListener);
    }
    
    private async handleVipPlay(): Promise<void> {
        if (this.vipProcessing) {
            return;
        }

        if (!authService.isAuthenticated()) {
            this.showVipLoginModal();
            return;
        }

        this.isAuthenticated = true;

        if (!this.walletInfoContainer) {
            this.createWalletInfo(this.cameras.main.width, this.cameras.main.height);
        }

        let shouldStartVip = false;

        try {
            this.vipProcessing = true;
            const credit = await walletService.getCredit();
            if (credit >= 1) {
                this.hideVipModal();
                shouldStartVip = true;
            } else {
                this.showVipDepositModal('Credit is still below the requirement. Please deposit to join VIP rooms.');
            }
        } catch (error) {
            console.error('Không thể lấy credit hiện tại', error);
            this.showVipDepositModal('Không thể kiểm tra credit. Vui lòng thử nạp lại.');
        } finally {
            this.vipProcessing = false;
            if (shouldStartVip) {
                this.startGame('vip');
            }
        }
    }

    private showVipLoginModal(): void {
        this.hideVipModal();
        this.setMenuVisibility(false);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.vipModalOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
            .setScrollFactor(0)
            .setDepth(2000)
            .setInteractive();

        this.vipModalContainer = this.add.container(width / 2, height / 2 - 40).setDepth(2001);

        const panel = this.add.rectangle(0, 0, 420, 260, 0x0a2463, 0.95)
            .setOrigin(0.5)
            .setStrokeStyle(3, 0x3e92cc, 0.8);
        this.vipModalContainer.add(panel);

        const title = this.add.text(0, -90, 'Chơi VIP cần Phantom', {
            fontFamily: 'Arial',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        const description = this.add.text(0, -40, 'Kết nối Phantom wallet để tham gia phòng VIP và nhận thưởng.', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#9ad6ff',
            align: 'center',
            wordWrap: { width: 360 }
        }).setOrigin(0.5);

        const statusText = this.add.text(0, 10, '', {
            fontFamily: 'Arial',
            fontSize: '13px',
            color: '#ffcb05',
            align: 'center',
            wordWrap: { width: 360 }
        }).setOrigin(0.5);

        const connectButton = this.createModalButton(0, 70, 'Kết nối Phantom', async () => {
            if (this.vipProcessing) return;
            await this.handleVipLoginFlow(statusText);
        });

        const cancelButton = this.createModalButton(0, 120, 'Để sau', () => this.hideVipModal(), 0x4A5568, 0x718096);

        this.vipModalContainer.add([title, description, statusText, connectButton, cancelButton]);
    }

    private async handleVipLoginFlow(statusText: Phaser.GameObjects.Text): Promise<void> {
        try {
            this.vipProcessing = true;
            statusText.setColor('#ffcb05');
            statusText.setText('Đang mở Phantom...');

            await authService.login();
            this.isAuthenticated = true;
            statusText.setText('Đăng nhập thành công! Đang kiểm tra credit...');

            walletService.startPolling(3000);
            if (!this.walletInfoContainer) {
                this.createWalletInfo(this.cameras.main.width, this.cameras.main.height);
            }

            const credit = await walletService.getCredit();
            if (credit >= 1) {
                statusText.setColor('#4caf50');
                statusText.setText('Login successful! You are ready to play VIP. Click PLAY VIP to join.');
                this.time.delayedCall(1200, () => {
                    const scenePlugin = this.scene;
                    if (scenePlugin && scenePlugin.isActive(scenePlugin.key)) {
                        this.hideVipModal();
                    }
                });
            } else {
                statusText.setColor('#ffcb05');
                statusText.setText('Credit is still below the requirement. Please deposit to join VIP rooms.');
                this.time.delayedCall(400, () => this.showVipDepositModal());
            }
        } catch (error: any) {
            console.error('Kết nối Phantom thất bại', error);
            statusText.setColor('#ff6666');
            const message = error?.message || 'Kết nối thất bại. Vui lòng thử lại.';
            statusText.setText(message);
        } finally {
            this.vipProcessing = false;
        }
    }

    private showVipDepositModal(initialStatusMessage?: string): void {
        this.hideVipModal();
        this.setMenuVisibility(false);
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.vipModalOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
            .setScrollFactor(0)
            .setDepth(2000)
            .setInteractive();

        this.vipModalContainer = this.add.container(width / 2, height / 2).setDepth(2001);

        const panelWidth = 420;
        const panelHeight = 340;

        const shadow = this.add.rectangle(0, 12, panelWidth + 30, panelHeight + 30, 0x000000, 0.35).setOrigin(0.5);
        this.vipModalContainer.add(shadow);

        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x0b2a6b, 0.96)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0x52a8ff, 0.85);
        this.vipModalContainer.add(panel);

        const title = this.add.text(0, -panelHeight / 2 + 40, 'Deposit Tokens', {
                fontFamily: 'Arial',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff',
        })
            .setOrigin(0.5)
            .setShadow(0, 2, '#05173d', 0.8, true, false);
        this.vipModalContainer.add(title);

        const currentCredit = walletService.getCachedCredit();
        const creditDisplay = this.add.text(0, title.y + 26, `Current credit: ${walletService.formatCredit(currentCredit)} credit`, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#9ad6ff',
        }).setOrigin(0.5);
        this.vipModalContainer.add(creditDisplay);

        const formHtml = `
            <div style="display:flex;flex-direction:column;align-items:stretch;gap:18px;width:280px;font-family:Arial;">
                <label style="display:flex;flex-direction:column;gap:6px;color:#ffffff;font-size:14px;text-align:left;">
                    <span>Amount</span>
                    <input id="vip-deposit-amount" type="number" min="0.000001" step="0.000001" value="1"
                        style="padding:10px;border-radius:8px;border:2px solid #3e92cc;background:rgba(8,24,60,0.9);color:#ffffff;font-size:15px;outline:none;" />
                </label>
                <button id="vip-deposit-action" type="button"
                    style="padding:12px;border-radius:8px;background:#ff9500;color:#ffffff;border:none;font-weight:bold;font-size:15px;cursor:pointer;">
                    Deposit
                </button>
                <div id="vip-deposit-status" style="min-height:54px;font-size:13px;color:#ffcb05;text-align:center;line-height:1.4;"></div>
                <button id="vip-cancel" type="button"
                    style="padding:10px;border-radius:8px;background:#4a5568;color:#ffffff;border:none;font-weight:bold;cursor:pointer;">
                    Close
                </button>
            </div>
        `;

        this.vipDomElement = this.add.dom(0, creditDisplay.y + 110).createFromHTML(formHtml).setOrigin(0.5);
        this.vipModalContainer.add(this.vipDomElement);

        const node = this.vipDomElement.node as HTMLElement;
        const amountInput = node.querySelector('#vip-deposit-amount') as HTMLInputElement;
        const statusElement = node.querySelector('#vip-deposit-status') as HTMLElement;
        const depositButton = node.querySelector('#vip-deposit-action') as HTMLButtonElement;
        const cancelButton = node.querySelector('#vip-cancel') as HTMLButtonElement;

        if (statusElement) {
            statusElement.style.color = '#ffcb05';
            statusElement.innerText = initialStatusMessage ?? 'Enter the amount and press Deposit.';
        }

        depositButton?.addEventListener('click', async () => {
            if (!amountInput || !statusElement || !depositButton) return;
            await this.handleVipDepositFlow(amountInput, statusElement, depositButton, creditDisplay);
        });

        cancelButton?.addEventListener('click', () => this.hideVipModal());
    }

    private async handleVipDepositFlow(
        amountInput: HTMLInputElement,
        statusElement: HTMLElement,
        depositButton: HTMLButtonElement,
        creditDisplay: Phaser.GameObjects.Text
    ): Promise<void> {
        if (this.vipProcessing) {
            return;
        }

        const walletAddress = authService.getWalletAddress();
        if (!walletAddress) {
            statusElement.style.color = '#ff6666';
            statusElement.innerText = 'Wallet not found. Please connect Phantom first.';
            this.showVipLoginModal();
            return;
        }

        const amount = Number(amountInput.value);
        if (!amount || amount <= 0) {
            statusElement.style.color = '#ff6666';
            statusElement.innerText = 'Amount must be greater than 0.';
            return;
        }

        const provider = this.getPhantomProvider();
        if (!provider?.publicKey || typeof provider.signTransaction !== 'function') {
            statusElement.style.color = '#ff6666';
            statusElement.innerText = 'Phantom wallet is not available. Please reconnect.';
            return;
        }

        try {
            this.vipProcessing = true;
            depositButton.disabled = true;

            const previousCredit = walletService.getCachedCredit();

            statusElement.style.color = '#ffcb05';
            statusElement.innerText = 'Generating deposit metadata...';

            const response = await apiService.post('/wallet/deposit', {
                walletAddress,
                amount
            });

            const metadata = this.extractDepositMetadata(response, amount);
            if (!metadata.tokenMint) {
                throw new Error('Token mint is missing in metadata.');
            }

            statusElement.innerText = 'Building transaction...';

            const connection = new Connection(this.rpcEndpoint || DEFAULT_RPC_ENDPOINT, 'confirmed');
            const sdk = new VaultSDK({ connection, programId: PROGRAM_ID });

            const mint = new PublicKey(metadata.tokenMint);
            const rawAmount = Math.round(metadata.amount * (10 ** metadata.decimals));

            const transaction = await sdk.buildDepositTransaction({
                amount: rawAmount,
                user: provider.publicKey,
                mint,
            });

            transaction.feePayer = provider.publicKey;
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;

            statusElement.innerText = 'Signing transaction in Phantom...';
            const signed = await provider.signTransaction(transaction);

            statusElement.innerText = 'Sending transaction to Solana...';
            const signature = await connection.sendRawTransaction(signed.serialize());

            statusElement.innerText = 'Confirming transaction...';
            await connection.confirmTransaction(signature, 'confirmed');

            const solscanUrl = this.getSolscanTxUrl(signature);
            statusElement.innerHTML = this.buildWaitingHtml(signature, solscanUrl, 'Checking credit balance...');

            const newCredit = await walletService.getCredit();
            const formattedCredit = walletService.formatCredit(newCredit);
            creditDisplay.setText(`Current credit: ${formattedCredit} credit`);

            if (newCredit > previousCredit) {
                this.showDepositSuccess(statusElement, signature, solscanUrl, formattedCredit);
            } else {
                await this.pollCreditForUpdate(previousCredit, signature, creditDisplay, statusElement, solscanUrl);
            }
        } catch (error: any) {
            console.error('Deposit failed', error);
            statusElement.style.color = '#ff6666';
            const message = error?.message ?? 'Deposit failed. Please try again.';
            statusElement.innerText = message;
        } finally {
            this.vipProcessing = false;
            depositButton.disabled = false;
        }
    }

    private extractDepositMetadata(response: any, fallbackAmount: number): DepositMetadata {
        const payload = (response?.data ?? response) as Record<string, unknown>;
        const rawMetadata = (payload?.['metadata'] ?? payload) as Record<string, unknown>;

        const tokenMint = String(rawMetadata.tokenMint ?? rawMetadata.mint ?? '');
        const decimalsValue = Number(
            rawMetadata.decimals ??
            rawMetadata.decimal ??
            payload?.['decimals'] ??
            payload?.['decimal'] ??
            6
        );
        const amountValue = Number(
            rawMetadata.amount ??
            rawMetadata.value ??
            rawMetadata.rawAmount ??
            rawMetadata.formattedAmount ??
            payload?.['amount'] ??
            payload?.['value'] ??
            payload?.['rawAmount'] ??
            fallbackAmount
        );

        const memo = String(rawMetadata.memo ?? payload?.['memo'] ?? '');
        const referenceCode = String(rawMetadata.referenceCode ?? payload?.['referenceCode'] ?? '');

        return {
            raw: rawMetadata,
            tokenMint,
            decimals: Number.isNaN(decimalsValue) ? 6 : decimalsValue,
            amount: Number.isNaN(amountValue) ? fallbackAmount : amountValue,
            memo: memo || undefined,
            referenceCode: referenceCode || undefined
        };
    }

    private hideVipModal(): void {
        if (this.vipDomElement) {
            this.vipDomElement.destroy();
            this.vipDomElement = undefined;
        }

        if (this.vipModalContainer) {
            this.vipModalContainer.destroy();
            this.vipModalContainer = undefined;
        }

        if (this.vipModalOverlay) {
            this.vipModalOverlay.destroy();
            this.vipModalOverlay = undefined;
        }

        this.setMenuVisibility(true);
    }

    private async pollCreditForUpdate(
        previousCredit: number,
        signature: string,
        creditDisplay: Phaser.GameObjects.Text,
        statusElement: HTMLElement,
        solscanUrl: string
    ): Promise<void> {
        const maxAttempts = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await this.delay(3000);
            const refreshedCredit = await walletService.getCredit();
            const formattedCredit = walletService.formatCredit(refreshedCredit);
            creditDisplay.setText(`Current credit: ${formattedCredit} credit`);

        if (refreshedCredit > previousCredit) {
            this.showDepositSuccess(statusElement, signature, solscanUrl, formattedCredit);
                return;
            }

            const remaining = maxAttempts - attempt - 1;
            const waitingMessage =
                remaining > 0
                    ? `Waiting for credit update from webhook... (${remaining} more tries)`
                    : 'Waiting for credit update from webhook...';
            statusElement.innerHTML = this.buildWaitingHtml(signature, solscanUrl, waitingMessage);
        }

        statusElement.innerHTML = `
            <div style="color:#ff6666;font-weight:bold;">Credit has not updated yet.</div>
            <div style="margin-top:6px;color:#9ad6ff;">${this.buildSolscanLink(signature, solscanUrl)}</div>
            <div style="margin-top:6px;color:#ffffff;">You can still join VIP manually once credit updates.</div>
            ${this.renderJoinVipButton(false)}
        `;
    }

    private createModalButton(
        x: number,
        y: number,
        text: string,
        onClick: () => void | Promise<void>,
        backgroundColor: number = 0xFF9500,
        borderColor: number = 0xFFFFFF
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);

        const buttonWidth = 240;
        const buttonHeight = 48;

        const bg = this.add.graphics();
        bg.fillGradientStyle(
            backgroundColor,
            backgroundColor,
            Phaser.Display.Color.GetColor(
                Phaser.Display.Color.IntegerToRGB(backgroundColor).r * 0.8,
                Phaser.Display.Color.IntegerToRGB(backgroundColor).g * 0.8,
                Phaser.Display.Color.IntegerToRGB(backgroundColor).b * 0.8
            ),
            Phaser.Display.Color.GetColor(
                Phaser.Display.Color.IntegerToRGB(backgroundColor).r * 0.6,
                Phaser.Display.Color.IntegerToRGB(backgroundColor).g * 0.6,
                Phaser.Display.Color.IntegerToRGB(backgroundColor).b * 0.6
            ),
            1, 1, 1, 1
        );
        bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
        bg.lineStyle(2, borderColor, 0.9);
        bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
            Phaser.Geom.Rectangle.Contains
        );
        container.add(bg);

        const label = this.add.text(0, 0, text, {
            fontFamily: 'Arial',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
        container.add(label);

        bg.on('pointerover', () => {
            this.tweens.add({
                targets: container,
                scale: 1.05,
                duration: 150,
                ease: 'Back.easeOut'
            });
        });

        bg.on('pointerout', () => {
            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 150,
                ease: 'Back.easeIn'
            });
        });

        bg.on('pointerdown', () => {
            this.tweens.add({
                targets: container,
                scale: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    Promise.resolve(onClick()).catch((error) => {
                        console.error('Modal button action error', error);
                    });
                }
            });
        });

        return container;
    }

    private buildSuccessHtml(signature: string, solscanUrl: string, formattedCredit: string): string {
        return `
            <div style="color:#4caf50;font-weight:bold;">Deposit confirmed!</div>
            <div style="color:#ffffff;">Signature: ${this.buildSolscanLink(signature, solscanUrl)}</div>
            <div style="color:#ffcb05;">Credit: ${formattedCredit} credit</div>
        `;
    }

    private buildWaitingHtml(signature: string, solscanUrl: string, message: string): string {
        return `
            <div style="color:#ffcb05;">${message}</div>
            <div style="margin-top:6px;color:#9ad6ff;">${this.buildSolscanLink(signature, solscanUrl)}</div>
        `;
    }

    private buildSolscanLink(signature: string, solscanUrl: string): string {
        return `<a href="${solscanUrl}" target="_blank" rel="noopener noreferrer" style="color:#9ad6ff;text-decoration:underline;word-break:break-all;">${signature}</a>`;
    }

    private getSolscanTxUrl(signature: string): string {
        const cluster = this.resolveSolanaCluster();
        const suffix = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
        return `https://solscan.io/tx/${signature}${suffix}`;
    }

    private resolveSolanaCluster(): string {
        const endpoint = (this.rpcEndpoint || DEFAULT_RPC_ENDPOINT).toLowerCase();
        if (endpoint.includes('devnet')) return 'devnet';
        if (endpoint.includes('testnet')) return 'testnet';
        return 'mainnet-beta';
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private renderJoinVipButton(enabled: boolean = true): string {
        const buttonId = enabled ? 'vip-success-join' : 'vip-success-join-disabled';
        return `
            <div style="margin-top:12px;display:flex;justify-content:center;">
                <button id="${buttonId}" style="
                    padding:10px 18px;
                    border-radius:8px;
                    border:none;
                    background:${enabled ? '#4caf50' : '#4a5568'};
                    color:#ffffff;
                    font-weight:bold;
                    cursor:${enabled ? 'pointer' : 'default'};
                " ${enabled ? '' : 'disabled'}>
                    Play VIP Now
                </button>
            </div>
        `;
    }

    private showDepositSuccess(
        statusElement: HTMLElement,
        signature: string,
        solscanUrl: string,
        formattedCredit: string
    ): void {
        statusElement.innerHTML = this.buildSuccessHtml(signature, solscanUrl, formattedCredit);
        statusElement.innerHTML += this.renderJoinVipButton(true);

        this.addVipSuccessListeners();
    }

    private addVipSuccessListeners(): void {
        const joinButton = document.getElementById('vip-success-join');
        joinButton?.addEventListener('click', () => {
            this.hideVipModal();
            this.startGame('vip');
        });
    }

    private getPhantomProvider(): (PhantomProvider & { publicKey?: PublicKey; signTransaction?: (transaction: any) => Promise<any> }) | null {
        if (typeof window === 'undefined') {
            return null;
        }

        const provider = window.solana as (PhantomProvider & { publicKey?: PublicKey; signTransaction?: (transaction: any) => Promise<any> }) | undefined;
        if (provider?.isPhantom) {
            return provider;
        }

        const legacyProvider = window.phantom?.solana as (PhantomProvider & { publicKey?: PublicKey; signTransaction?: (transaction: any) => Promise<any> }) | undefined;
        if (legacyProvider) {
            return legacyProvider;
        }

        return null;
    }
    
    private createGameButton(
        x: number,
        y: number,
        text: string,
        color: number,
        onClick: () => void
    ): Phaser.GameObjects.Container {
        const buttonContainer = this.add.container(x, y);
        
        // Button glow
        const buttonGlow = this.add.graphics();
        buttonGlow.fillStyle(color, 0.5);
        buttonGlow.fillRoundedRect(-90, -25, 180, 60, 16);
        buttonGlow.setAlpha(0);
        buttonContainer.add(buttonGlow);
        
        // Button background
        const buttonBg = this.add.graphics();
        buttonBg.fillGradientStyle(
            color, color,
            Phaser.Display.Color.GetColor(
                Phaser.Display.Color.IntegerToRGB(color).r * 0.7,
                Phaser.Display.Color.IntegerToRGB(color).g * 0.7,
                Phaser.Display.Color.IntegerToRGB(color).b * 0.7
            ),
            Phaser.Display.Color.GetColor(
                Phaser.Display.Color.IntegerToRGB(color).r * 0.7,
                Phaser.Display.Color.IntegerToRGB(color).g * 0.7,
                Phaser.Display.Color.IntegerToRGB(color).b * 0.7
            ),
            1, 1, 1, 1
        );
        buttonBg.fillRoundedRect(-90, -25, 180, 60, 16);
        buttonBg.lineStyle(3, 0xFFFFFF, 0.8);
        buttonBg.strokeRoundedRect(-90, -25, 180, 60, 16);
        buttonBg.setInteractive(
            new Phaser.Geom.Rectangle(-90, -25, 180, 60),
            Phaser.Geom.Rectangle.Contains
        );
        buttonContainer.add(buttonBg);
        
        // Button text
        const buttonText = this.add.text(0, 0, text, {
            fontFamily: 'Arial',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        buttonContainer.add(buttonText);
        
        // Button effects
        buttonBg.on('pointerover', () => {
            if (buttonContainer.alpha === 1) {
                this.tweens.add({
                    targets: buttonContainer,
                    scale: 1.1,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
                this.tweens.add({
                    targets: buttonGlow,
                    alpha: 1,
                    duration: 200
                });
            }
        });
        
        buttonBg.on('pointerout', () => {
            this.tweens.add({
                targets: buttonContainer,
                scale: 1,
                duration: 200,
                ease: 'Back.easeIn'
            });
            this.tweens.add({
                targets: buttonGlow,
                alpha: 0,
                duration: 200
            });
        });
        
        buttonBg.on('pointerdown', () => {
            if (buttonContainer.alpha === 1) {
                this.tweens.add({
                    targets: buttonContainer,
                    scale: 0.95,
                    duration: 100,
                    yoyo: true,
                    onComplete: onClick
                });
            }
        });
        
        return buttonContainer;
    }
    
    private async startGame(roomType: RoomType) {
        // Get player name from input
        const inputElement = document.getElementById('nameInput') as HTMLInputElement;
        if (inputElement) {
            this.playerName = inputElement.value || 'Player';
        }
        
        // Check VIP requirements
        let vipAccess: VipAccessCheckResult | undefined;

        if (roomType === 'vip') {
            if (this.vipProcessing) {
                return;
            }

            if (!this.isAuthenticated) {
                alert('Please login with Phantom wallet to play VIP rooms');
                return;
            }

            try {
                this.vipProcessing = true;
                vipAccess = await vipRoomService.checkAccess();

                if (!vipAccess.canJoin || !vipAccess.ticket?.id) {
                    const message =
                        vipAccess.reason ??
                        'You do not have enough credit to join the VIP room.';
                    alert(message);
                    return;
                }
            } catch (error) {
                console.error('❌ Failed to prepare VIP access:', error);
                alert('Unable to verify VIP access. Please try again.');
                return;
            } finally {
                this.vipProcessing = false;
            }
        }
        
        // Stop polling credit
        walletService.stopPolling();
        
        // Transition to game
        const sceneData =
            roomType === 'vip' && vipAccess
                ? {
                      playerName: this.playerName,
                      skinId: this.selectedSkin,
                      roomType,
                      vipTicketId: vipAccess.ticket?.id,
                      vipTicketCode: vipAccess.ticket?.ticketCode,
                      vipConfig: vipAccess.config,
                      vipCredit: vipAccess.credit,
                  }
                : {
                      playerName: this.playerName,
                      skinId: this.selectedSkin,
                      roomType,
                  };

        this.cameras.main.fade(500, 0, 0, 0, false, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress === 1) {
                this.scene.start('GameScene', {
                    ...sceneData,
                    isAuthenticated: this.isAuthenticated,
                });
            }
        });
    }
    
    shutdown() {
        // Clean up when scene is shut down
        walletService.stopPolling();
        if (this.creditUpdateHandler) {
            this.events.off('update', this.creditUpdateHandler);
            this.creditUpdateHandler = undefined;
        }
    }
} 