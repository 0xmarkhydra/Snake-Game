import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GAME_INFO } from '../../configs/game';
import { authService } from '../../services/AuthService';

export class LoginScene extends Scene {
    private isConnecting: boolean = false;
    private statusText: Phaser.GameObjects.Text;
    private connectButton: Phaser.GameObjects.Container;
    private guestButton: Phaser.GameObjects.Container;
    
    constructor() {
        super('LoginScene');
    }
    
    create() {
        // Reset state when scene restarts (after logout, etc.)
        this.isConnecting = false;
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create animated background (same as MenuScene)
        this.createAnimatedBackground(width, height);
        
        // Create main container
        const mainContainer = this.add.container(width / 2, height / 2);
        
        // Add title with animation
        this.createAnimatedTitle(mainContainer, 0, -height / 3.5);
        
        // Check if already authenticated
        if (authService.isAuthenticated()) {
            console.log('✅ Already logged in! Redirecting to menu...');
            this.time.delayedCall(1000, () => {
                this.scene.start('MenuScene', { isAuthenticated: true });
            });
            return;
        }
        
        // Create login panel
        this.createLoginPanel(mainContainer, width, height);
        
        // Notify that the scene is ready
        EventBus.emit('current-scene-ready', this);
    }
    
    private createAnimatedBackground(width: number, height: number) {
        // Background with gradient (same as MenuScene)
        const bg = this.add.graphics();
        bg.fillGradientStyle(
            0x0a2463, 0x0a2463,  // Dark blue at top
            0x3e92cc, 0x3e92cc,  // Light blue at bottom
            1, 1, 1, 1
        );
        bg.fillRect(0, 0, width, height);
        
        // Grid pattern
        const grid = this.add.grid(
            width / 2, height / 2,
            width, height,
            32, 32,
            undefined, undefined,
            0xffffff, 0.1
        );
        
        // Add particles
        if (this.textures.exists('food')) {
            const particles = this.add.particles(0, 0, 'food', {
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
                tint: [0x3e92cc, 0x5ca4d5, 0x0a2463]
            });
        }
    }
    
    private createAnimatedTitle(container: Phaser.GameObjects.Container, x: number, y: number) {
        // Title shadow
        const titleShadow = this.add.text(x + 4, y + 4, GAME_INFO.name, {
            fontFamily: 'Arial',
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#000000',
            align: 'center'
        }).setOrigin(0.5);
        
        // Main title
        const title = this.add.text(x, y, GAME_INFO.name, {
            fontFamily: 'Arial',
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Glow effect
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
        
        // Subtitle
        const subtitle = this.add.text(x, y + 70, 'Connect Your Wallet', {
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
    
    private createLoginPanel(container: Phaser.GameObjects.Container, width: number, height: number) {
        // Panel background
        const panelWidth = Math.min(500, width * 0.8);
        const panelHeight = 400;
        
        const panel = this.add.graphics();
        panel.fillGradientStyle(
            0x0a2463, 0x0a2463,
            0x081f52, 0x081f52,
            0.9, 0.9, 0.9, 0.9
        );
        panel.fillRoundedRect(-panelWidth / 2, -100, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0x3e92cc, 0.8);
        panel.strokeRoundedRect(-panelWidth / 2, -100, panelWidth, panelHeight, 20);
        container.add(panel);
        
        // Status text
        this.statusText = this.add.text(0, -50, '', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5);
        container.add(this.statusText);
        
        // Connect Phantom button
        this.connectButton = this.createButton(
            0, 30,
            'Connect Phantom Wallet',
            0xFF9500, // Phantom purple
            () => this.handlePhantomLogin()
        );
        container.add(this.connectButton);
        
        // Guest button
        this.guestButton = this.createButton(
            0, 130,
            'Play as Guest',
            0x4CAF50, // Green
            () => this.handleGuestLogin()
        );
        container.add(this.guestButton);
        
        // Info text
        const infoText = this.add.text(0, 230, 
            'Connect with Phantom to play VIP rooms\nor play as guest for free rooms', 
            {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#aaaaaa',
                align: 'center',
                wordWrap: { width: panelWidth - 40 }
            }
        ).setOrigin(0.5);
        container.add(infoText);
        
        // Add Exit button at bottom left corner
        // this.createExitButton(20, height - 20);
        
        // Animate container entrance
        container.setAlpha(0);
        container.setScale(0.8);
        this.tweens.add({
            targets: container,
            alpha: 1,
            scale: 1,
            duration: 800,
            ease: 'Back.easeOut',
            delay: 300
        });
    }
    
    private createButton(
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
        buttonGlow.fillRoundedRect(-140, -30, 280, 70, 16);
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
        buttonBg.fillRoundedRect(-140, -30, 280, 70, 16);
        buttonBg.lineStyle(3, 0xFFFFFF, 0.8);
        buttonBg.strokeRoundedRect(-140, -30, 280, 70, 16);
        buttonBg.setInteractive(
            new Phaser.Geom.Rectangle(-140, -30, 280, 70),
            Phaser.Geom.Rectangle.Contains
        );
        buttonContainer.add(buttonBg);
        
        // Button text
        const buttonText = this.add.text(0, 5, text, {
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
            if (!this.isConnecting) {
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
            if (!this.isConnecting) {
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
            }
        });
        
        buttonBg.on('pointerdown', () => {
            if (!this.isConnecting) {
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
    
    private async handlePhantomLogin() {
        if (this.isConnecting) return;
        
        // Check if Phantom is installed
        if (!authService.isPhantomInstalled()) {
            this.showStatus('⚠️ Phantom wallet not found!\nPlease install from phantom.app', 0xFF0000);
            
            // Open Phantom website after 2 seconds
            this.time.delayedCall(2000, () => {
                window.open('https://phantom.app/', '_blank');
            });
            return;
        }
        
        this.isConnecting = true;
        this.showStatus('🔗 Connecting to Phantom...', 0xFFFF00);
        this.disableButtons();
        
        try {
            // Step 1: Connect wallet
            this.showStatus('🔗 Connecting to Phantom...', 0xFFFF00);
            await authService.connectPhantom();
            
            // Step 2: Request nonce
            this.showStatus('📝 Requesting authentication...', 0xFFFF00);
            await this.delay(500);
            
            // Step 3: Complete login
            this.showStatus('✍️ Please sign the message in Phantom...', 0xFFFF00);
            const result = await authService.login();
            
            // Success
            this.showStatus(`✅ Welcome, ${authService.formatWalletAddress(result.user.walletAddress)}!`, 0x4CAF50);
            
            // Transition to menu
            this.time.delayedCall(1000, () => {
                this.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
                    if (progress === 1) {
                        this.scene.start('MenuScene', { isAuthenticated: true });
                    }
                });
            });
            
        } catch (error: any) {
            console.error('Login error:', error);
            
            let errorMessage = '❌ Login failed!';
            if (error.message?.includes('User rejected')) {
                errorMessage = '❌ Connection rejected';
            } else if (error.message?.includes('Phantom')) {
                errorMessage = '❌ Phantom wallet error';
            }
            
            this.showStatus(errorMessage, 0xFF0000);
            this.isConnecting = false;
            this.enableButtons();
        }
    }
    
    private handleGuestLogin() {
        if (this.isConnecting) return;
        
        this.showStatus('🎮 Entering as guest...', 0x4CAF50);
        
        this.cameras.main.fade(500, 0, 0, 0, false, (camera, progress) => {
            if (progress === 1) {
                this.scene.start('MenuScene', { isAuthenticated: false });
            }
        });
    }
    
    private showStatus(message: string, color: number) {
        this.statusText.setText(message);
        this.statusText.setColor('#' + color.toString(16).padStart(6, '0'));
        
        // Pulse animation
        this.tweens.add({
            targets: this.statusText,
            scale: 1.1,
            duration: 200,
            yoyo: true
        });
    }
    
    private disableButtons() {
        this.connectButton.setAlpha(0.5);
        this.guestButton.setAlpha(0.5);
    }
    
    private enableButtons() {
        this.connectButton.setAlpha(1);
        this.guestButton.setAlpha(1);
    }
    
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => this.time.delayedCall(ms, resolve));
    }
    
    private createExitButton(x: number, y: number) {
        const exitContainer = this.add.container(x, y)
            .setScrollFactor(0)
            .setDepth(1000);
        
        // Button background
        const btnWidth = 100;
        const btnHeight = 40;
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x8B0000, 0.9); // Dark red
        buttonBg.fillRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        buttonBg.lineStyle(2, 0xFF0000, 0.8);
        buttonBg.strokeRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        buttonBg.setInteractive(
            new Phaser.Geom.Rectangle(0, -btnHeight, btnWidth, btnHeight),
            Phaser.Geom.Rectangle.Contains
        );
        exitContainer.add(buttonBg);
        
        // Button text
        const buttonText = this.add.text(btnWidth / 2, -btnHeight / 2, '❌ Exit', {
            fontFamily: 'Arial',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        exitContainer.add(buttonText);
        
        // Button effects
        buttonBg.on('pointerover', () => {
            this.tweens.add({
                targets: exitContainer,
                scale: 1.1,
                duration: 200,
                ease: 'Back.easeOut'
            });
            buttonBg.clear();
            buttonBg.fillStyle(0xFF0000, 1);
            buttonBg.fillRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
            buttonBg.lineStyle(2, 0xFFFFFF, 1);
            buttonBg.strokeRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        });
        
        buttonBg.on('pointerout', () => {
            this.tweens.add({
                targets: exitContainer,
                scale: 1,
                duration: 200,
                ease: 'Back.easeIn'
            });
            buttonBg.clear();
            buttonBg.fillStyle(0x8B0000, 0.9);
            buttonBg.fillRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
            buttonBg.lineStyle(2, 0xFF0000, 0.8);
            buttonBg.strokeRoundedRect(0, -btnHeight, btnWidth, btnHeight, 8);
        });
        
        buttonBg.on('pointerdown', () => {
            this.tweens.add({
                targets: exitContainer,
                scale: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    // Close window or go to homepage
                    if (confirm('Are you sure you want to exit the game?')) {
                        window.close();
                        // If window.close doesn't work (blocked by browser), redirect to homepage
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 100);
                    }
                }
            });
        });
        
        // Animate entrance
        exitContainer.setAlpha(0);
        this.tweens.add({
            targets: exitContainer,
            alpha: 1,
            duration: 500,
            delay: 1000
        });
    }
}

