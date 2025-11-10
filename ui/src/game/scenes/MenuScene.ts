import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GAME_INFO } from '../../configs/game';
import { authService } from '../../services/AuthService';
import { walletService } from '../../services/WalletService';

interface MenuSceneData {
    isAuthenticated?: boolean;
}

export class MenuScene extends Scene {
    private playerName: string = 'Player';
    private selectedSkin: number = 0;
    private skins: number[] = [0, 1, 2, 3, 4, 5, 6, 7]; // Skin IDs
    private skinImages: Phaser.GameObjects.Image[] = [];
    private backgroundParticles: Phaser.GameObjects.Particles.ParticleEmitterManager;
    private titleTween: Phaser.Tweens.Tween;
    private isAuthenticated: boolean = false;
    private creditText: Phaser.GameObjects.Text;
    
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
        
        // Add wallet info at top if authenticated
        if (this.isAuthenticated) {
            this.createWalletInfo(width, height);
        }
        
        // Add Back button at bottom left
        this.createBackButton(20, height - 20);
        
        // Create a container for the menu content
        const menuContainer = this.add.container(width / 2, height / 2);
        
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
        const nameInput = this.add.dom(0, -80).createFromHTML(`
            <input type="text" id="nameInput" maxlength="15" placeholder="Enter your name" 
                   style="padding: 12px; width: 240px; text-align: center; border-radius: 8px; 
                   border: 2px solid #3e92cc; background-color: rgba(10,36,99,0.7); color: white; 
                   font-size: 18px; font-family: Arial; outline: none; box-shadow: 0 0 10px #3e92cc;">
        `);
        menuContainer.add(nameInput);
        
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
        const instructions = this.add.text(width / 2, height - 40, 'Use mouse to control direction. Click to boost. Eat food to grow. Avoid other snakes!', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            wordWrap: { width: width * 0.6 }
        }).setOrigin(0.5);
        
        // Add version info
        const version = this.add.text(width - 10, height - 10, `v${GAME_INFO.version}`, {
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
        const grid = this.add.grid(
            width / 2, height / 2,
            width, height,
            32, 32,  // Same grid size as LoadingScene
            undefined, undefined,
            0xffffff, 0.1  // Same color and alpha as LoadingScene
        );
        
        // Add particles for background with colors that match the new theme
        if (this.textures.exists('food')) {
            // Create particle emitters using the correct API
            const particles1 = this.add.particles(0, 0, 'food', {
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
            const particles2 = this.add.particles(0, 0, 'food', {
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
        this.titleTween = this.tweens.add({
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
    
    private createWalletInfo(width: number, height: number) {
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
        this.events.on('update', () => {
            if (this.creditText) {
                this.creditText.setText(walletService.formatCredit());
            }
        });
        
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
            this.scene.start('LoginScene');
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
            () => this.startGame('vip')
        );
        container.add(vipButton);
        
        // Add VIP lock icon if not enough credit
        if (this.isAuthenticated) {
            const vipInfo = this.add.text(130, 320, '', {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffaa00',
                align: 'center'
            }).setOrigin(0.5);
            container.add(vipInfo);
            
            // Update VIP button state based on credit
            this.events.on('update', () => {
                const hasCredit = walletService.hasEnoughCredit(1);
                if (!hasCredit) {
                    vipButton.setAlpha(0.5);
                    vipInfo.setText('Need 1+ credit');
                } else {
                    vipButton.setAlpha(1);
                    vipInfo.setText('');
                }
            });
        } else {
            // Show login prompt for guests
            const vipLock = this.add.text(130, 320, '🔒 Login required', {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ff6666',
                align: 'center'
            }).setOrigin(0.5);
            container.add(vipLock);
            
            vipButton.setAlpha(0.5);
        }
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
    
    private startGame(roomType: 'free' | 'vip') {
        // Get player name from input
        const inputElement = document.getElementById('nameInput') as HTMLInputElement;
        if (inputElement) {
            this.playerName = inputElement.value || 'Player';
        }
        
        // Check VIP requirements
        if (roomType === 'vip') {
            if (!this.isAuthenticated) {
                alert('Please login with Phantom wallet to play VIP rooms');
                return;
            }
            
            if (!walletService.hasEnoughCredit(1)) {
                alert('You need at least 1 credit to play VIP rooms');
                return;
            }
        }
        
        // Stop polling credit
        walletService.stopPolling();
        
        // Transition to game
        this.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
            if (progress === 1) {
                this.scene.start('GameScene', {
                    playerName: this.playerName,
                    skinId: this.selectedSkin,
                    roomType: roomType,
                    isAuthenticated: this.isAuthenticated
                });
            }
        });
    }
    
    shutdown() {
        // Clean up when scene is shut down
        walletService.stopPolling();
    }
    
    private createBackButton(x: number, y: number) {
        const backContainer = this.add.container(x, y)
            .setScrollFactor(0)
            .setDepth(1000);
        
        // Button background
        const btnWidth = 100;
        const btnHeight = 40;
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x4A5568, 0.9); // Gray
        buttonBg.fillRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        buttonBg.lineStyle(2, 0x718096, 0.8);
        buttonBg.strokeRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        buttonBg.setInteractive(
            new Phaser.Geom.Rectangle(0, -btnHeight, btnWidth, btnHeight),
            Phaser.Geom.Rectangle.Contains
        );
        backContainer.add(buttonBg);
        
        // Button text
        const buttonText = this.add.text(btnWidth / 2, -btnHeight / 2, '← Back', {
            fontFamily: 'Arial',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        backContainer.add(buttonText);
        
        // Button effects
        buttonBg.on('pointerover', () => {
            this.tweens.add({
                targets: backContainer,
                scale: 1.1,
                duration: 200,
                ease: 'Back.easeOut'
            });
            buttonBg.clear();
            buttonBg.fillStyle(0x718096, 1);
            buttonBg.fillRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
            buttonBg.lineStyle(2, 0xFFFFFF, 1);
            buttonBg.strokeRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        });
        
        buttonBg.on('pointerout', () => {
            this.tweens.add({
                targets: backContainer,
                scale: 1,
                duration: 200,
                ease: 'Back.easeIn'
            });
            buttonBg.clear();
            buttonBg.fillStyle(0x4A5568, 0.9);
            buttonBg.fillRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
            buttonBg.lineStyle(2, 0x718096, 0.8);
            buttonBg.strokeRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        });
        
        buttonBg.on('pointerdown', () => {
            this.tweens.add({
                targets: backContainer,
                scale: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    // Stop polling credit
                    walletService.stopPolling();
                    
                    // Go back to login scene
                    this.cameras.main.fade(300, 0, 0, 0, false, (camera, progress) => {
                        if (progress === 1) {
                            this.scene.start('LoginScene');
                        }
                    });
                }
            });
        });
        
        // Animate entrance
        backContainer.setAlpha(0);
        this.tweens.add({
            targets: backContainer,
            alpha: 1,
            duration: 500,
            delay: 500
        });
    }
} 