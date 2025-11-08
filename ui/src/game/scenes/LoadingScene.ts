import { Scene } from "phaser";
import { EventBus } from "../EventBus";

export class LoadingScene extends Scene {
    constructor() {
        super("LoadingScene");
    }

    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Loading text
        const loadingText = this.add
            .text(width / 2, height / 2 - 50, "Loading...", {
                fontFamily: "Arial",
                fontSize: "24px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        // Progress bar background
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);

        // Register progress events
        this.load.on("progress", (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(
                width / 2 - 150,
                height / 2 + 10,
                300 * value,
                10
            );
        });

        this.load.on("complete", () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();

            // Generate textures instead of loading images
            this.generateTextures();

            // Create dummy sound objects
            // this.createDummySounds();

            // Move to the menu scene
            this.scene.start("MenuScene");
        });

        // Load images
        this.load.image("background-mask", "images/background.jpg");

        // Load audio files
        this.load.audio("eat", "sounds/eat.mp3");
        this.load.audio("death", "sounds/death.wav");
        this.load.audio("boost", "sounds/eat.mp3"); // Reusing eat sound for boost
        this.load.audio("background", "sounds/background.mp3"); // Add background music
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
        // Generate background texture
        this.generateBackgroundTexture();

        // Generate snake head texture
        this.generateSnakeHeadTexture();

        // Generate snake body texture
        this.generateSnakeBodyTexture();

        // Generate food textures
        this.generateFoodTexture();
        this.generateSpecialFoodTexture();
    }

    private generateBackgroundTexture() {
        // Create a graphics object for the background
        const bgGraphics = this.add.graphics();

        // Fill with a gradient
        bgGraphics.fillGradientStyle(0x0a2463, 0x0a2463, 0x3e92cc, 0x3e92cc, 1);
        bgGraphics.fillRect(0, 0, 256, 256);

        // Add some grid lines
        bgGraphics.lineStyle(1, 0xffffff, 0.1);
        for (let i = 0; i < 256; i += 32) {
            bgGraphics.moveTo(0, i);
            bgGraphics.lineTo(256, i);
            bgGraphics.moveTo(i, 0);
            bgGraphics.lineTo(i, 256);
        }

        // Generate texture
        bgGraphics.generateTexture("background", 256, 256);
        bgGraphics.destroy();
    }

    private generateSnakeHeadTexture() {
        // Create a graphics object for the snake head
        const headGraphics = this.add.graphics();

        // 36x36 size!
        const centerX = 18;
        const centerY = 18;
        const radius = 16;

        // Create 3D sphere effect with radial gradient (multiple layers)
        // Outer shadow layer
        headGraphics.fillStyle(0x8b2c8b, 0.5); // Dark purple shadow
        headGraphics.fillCircle(centerX + 1, centerY + 1, radius);

        // Main body - create gradient effect by drawing multiple circles
        const colors = [
            { color: 0xff69b4, alpha: 1, size: 1.0 }, // Outer - hot pink
            { color: 0xff85c1, alpha: 1, size: 0.85 }, // Medium pink
            { color: 0xffa0d2, alpha: 1, size: 0.7 }, // Light pink
            { color: 0xffb8e0, alpha: 1, size: 0.5 }, // Very light pink
            { color: 0xffd0ed, alpha: 1, size: 0.3 }, // Almost white pink
        ];

        // Draw from largest to smallest for gradient effect
        for (const layer of colors) {
            headGraphics.fillStyle(layer.color, layer.alpha);
            headGraphics.fillCircle(centerX, centerY - 1, radius * layer.size);
        }

        // Highlight (3D light reflection)
        headGraphics.fillStyle(0xffffff, 0.7);
        headGraphics.fillCircle(centerX - 4, centerY - 6, 5);
        headGraphics.fillStyle(0xffffff, 0.3);
        headGraphics.fillCircle(centerX - 4, centerY - 6, 7);

        // Add eyes
        // Left eye
        headGraphics.fillStyle(0xffffff);
        headGraphics.fillCircle(centerX + 6, centerY - 2, 3.5);
        headGraphics.fillStyle(0x000000);
        headGraphics.fillCircle(centerX + 7, centerY - 1.5, 2.5);
        headGraphics.fillStyle(0xffffff, 0.9);
        headGraphics.fillCircle(centerX + 7.5, centerY - 2, 1.2);

        // Right eye
        headGraphics.fillStyle(0xffffff);
        headGraphics.fillCircle(centerX + 6, centerY + 2, 3.5);
        headGraphics.fillStyle(0x000000);
        headGraphics.fillCircle(centerX + 7, centerY + 2.5, 2.5);
        headGraphics.fillStyle(0xffffff, 0.9);
        headGraphics.fillCircle(centerX + 7.5, centerY + 2, 1.2);

        // Generate texture - 36x36!
        headGraphics.generateTexture("snake-head", 36, 36);
        headGraphics.destroy();
    }

    private generateSnakeBodyTexture() {
        // Create a graphics object for the snake body
        const bodyGraphics = this.add.graphics();

        // 36x36 size!
        const centerX = 18;
        const centerY = 18;
        const radius = 16;

        // Create 3D sphere effect with radial gradient
        // Outer shadow layer
        bodyGraphics.fillStyle(0x8b2c8b, 0.5); // Dark purple shadow
        bodyGraphics.fillCircle(centerX + 1, centerY + 1, radius);

        // Main body gradient layers
        const colors = [
            { color: 0xff69b4, alpha: 1, size: 1.0 }, // Outer - hot pink
            { color: 0xff85c1, alpha: 1, size: 0.85 }, // Medium pink
            { color: 0xffa0d2, alpha: 1, size: 0.7 }, // Light pink
            { color: 0xffb8e0, alpha: 1, size: 0.5 }, // Very light pink
            { color: 0xffd0ed, alpha: 1, size: 0.3 }, // Almost white pink
        ];

        for (const layer of colors) {
            bodyGraphics.fillStyle(layer.color, layer.alpha);
            bodyGraphics.fillCircle(centerX, centerY - 1, radius * layer.size);
        }

        // Highlight (3D light reflection)
        bodyGraphics.fillStyle(0xffffff, 0.7);
        bodyGraphics.fillCircle(centerX - 4, centerY - 6, 5);
        bodyGraphics.fillStyle(0xffffff, 0.3);
        bodyGraphics.fillCircle(centerX - 4, centerY - 6, 7);

        // Generate texture - 36x36!
        bodyGraphics.generateTexture("snake-body", 36, 36);
        bodyGraphics.destroy();
    }

    private generateFoodTexture() {
        // Generate multiple colored food textures with 3D effect
        const foodColors = [
            {
                name: "food",
                baseColor: 0xff4444,
                midColor: 0xff6666,
                lightColor: 0xff9999,
            }, // Red
            {
                name: "food-blue",
                baseColor: 0x4444ff,
                midColor: 0x6666ff,
                lightColor: 0x9999ff,
            }, // Blue
            {
                name: "food-green",
                baseColor: 0x44ff44,
                midColor: 0x66ff66,
                lightColor: 0x99ff99,
            }, // Green
            {
                name: "food-yellow",
                baseColor: 0xffff44,
                midColor: 0xffff66,
                lightColor: 0xffff99,
            }, // Yellow
            {
                name: "food-purple",
                baseColor: 0xff44ff,
                midColor: 0xff66ff,
                lightColor: 0xff99ff,
            }, // Purple
            {
                name: "food-orange",
                baseColor: 0xff8844,
                midColor: 0xffaa66,
                lightColor: 0xffcc99,
            }, // Orange
            {
                name: "food-cyan",
                baseColor: 0x44ffff,
                midColor: 0x66ffff,
                lightColor: 0x99ffff,
            }, // Cyan
        ];

        for (const food of foodColors) {
            const foodGraphics = this.add.graphics();

            const centerX = 10;
            const centerY = 10;
            const radius = 8;

            // Outer glow
            foodGraphics.fillStyle(food.baseColor, 0.3);
            foodGraphics.fillCircle(centerX, centerY, radius + 3);

            // Shadow
            foodGraphics.fillStyle(0x000000, 0.3);
            foodGraphics.fillCircle(centerX + 1, centerY + 1, radius);

            // Main sphere with gradient
            foodGraphics.fillStyle(food.baseColor);
            foodGraphics.fillCircle(centerX, centerY, radius);

            foodGraphics.fillStyle(food.midColor);
            foodGraphics.fillCircle(centerX, centerY - 1, radius * 0.7);

            foodGraphics.fillStyle(food.lightColor);
            foodGraphics.fillCircle(centerX - 1, centerY - 2, radius * 0.4);

            // Highlight (3D reflection)
            foodGraphics.fillStyle(0xffffff, 0.8);
            foodGraphics.fillCircle(centerX - 2, centerY - 3, 3);
            foodGraphics.fillStyle(0xffffff, 0.4);
            foodGraphics.fillCircle(centerX - 2, centerY - 3, 4);

            // Generate texture
            foodGraphics.generateTexture(food.name, 20, 20);
            foodGraphics.destroy();
        }
    }

    private generateSpecialFoodTexture() {
        // Create a graphics object for the special food
        const specialFoodGraphics = this.add.graphics();

        const centerX = 16;
        const centerY = 16;
        const radius = 12;

        // Outer strong glow
        specialFoodGraphics.fillStyle(0xffff00, 0.4);
        specialFoodGraphics.fillCircle(centerX, centerY, radius + 6);

        specialFoodGraphics.fillStyle(0xffff00, 0.6);
        specialFoodGraphics.fillCircle(centerX, centerY, radius + 3);

        // Shadow
        specialFoodGraphics.fillStyle(0xff8800, 0.4);
        specialFoodGraphics.fillCircle(centerX + 1, centerY + 1, radius);

        // Main sphere with golden gradient
        specialFoodGraphics.fillStyle(0xffaa00);
        specialFoodGraphics.fillCircle(centerX, centerY, radius);

        specialFoodGraphics.fillStyle(0xffdd00);
        specialFoodGraphics.fillCircle(centerX, centerY - 1, radius * 0.75);

        specialFoodGraphics.fillStyle(0xffff44);
        specialFoodGraphics.fillCircle(centerX - 1, centerY - 2, radius * 0.5);

        // Strong highlight
        specialFoodGraphics.fillStyle(0xffffff, 1);
        specialFoodGraphics.fillCircle(centerX - 3, centerY - 4, 4);
        specialFoodGraphics.fillStyle(0xffffff, 0.6);
        specialFoodGraphics.fillCircle(centerX - 3, centerY - 4, 6);

        // Draw small stars around for special effect
        specialFoodGraphics.fillStyle(0xffffff, 0.8);
        const starPositions = [
            { x: centerX - 10, y: centerY - 10 },
            { x: centerX + 10, y: centerY - 10 },
            { x: centerX - 10, y: centerY + 10 },
            { x: centerX + 10, y: centerY + 10 },
        ];

        for (const pos of starPositions) {
            // Draw small star
            specialFoodGraphics.fillCircle(pos.x, pos.y, 2);
        }

        // Generate texture
        specialFoodGraphics.generateTexture("special-food", 32, 32);
        specialFoodGraphics.destroy();
    }

    create() {
        // Notify that the scene is ready
        EventBus.emit("current-scene-ready", this);
    }
}
