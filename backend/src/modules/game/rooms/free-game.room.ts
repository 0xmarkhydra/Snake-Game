import { Client, Delayed, Room } from '@colyseus/core';
import { Food, Player, SnakeGameState, SnakeSegment } from './schema';
import { BotAI } from '../bot-ai';

export class FreeGameRoom extends Room<SnakeGameState> {
  maxClients = 20;
  tickRate = 8; // Increased from 16ms to 8ms (120fps) to match client target FPS
  gameLoopInterval: Delayed;
  foodRespawnInterval: Delayed; // Auto-respawn food periodically

  // Bot management
  private bots: Map<string, BotAI> = new Map();
  private readonly minPlayersForBots = 1; // Minimum real players before adding bots
  private readonly maxBots = 3; // Maximum 3 bots per game
  private readonly targetBots = 3; // Target: spawn 3 bots random
  private botNames: string[] = [
    'Alex',
    'Jordan',
    'Sam',
    'Taylor',
    'Casey',
    'Morgan',
    'Riley',
    'Avery',
    'Quinn',
    'Blake',
    'Cameron',
    'Dakota',
    'Emery',
    'Finley',
    'Harper',
    'Jamie',
    'Kai',
    'Logan',
    'Noah',
    'Parker',
    'River',
    'Sage',
    'Skyler',
    'Tyler',
    'Zoe',
    'Max',
    'Leo',
    'Aria',
    'Luna',
    'Maya',
    'Ethan',
    'Liam',
    'Emma',
    'Olivia',
    'Sophia',
    'Mia',
    'Isabella',
    'Charlotte',
    'Amelia',
    'Harper',
    'Evelyn',
    'Abigail',
    'Emily',
    'Elizabeth',
    'Mila',
    'Ella',
    'Avery',
    'Sofia',
    'Camila',
    'Aria',
  ];
  private usedBotNames: Set<string> = new Set();

  protected readonly colors = [
    '#FF5733',
    '#33FF57',
    '#3357FF',
    '#F3FF33',
    '#FF33F3',
    '#33FFF3',
    '#9933FF',
    '#FF3333',
  ];

  protected readonly degreeToRadian = Math.PI / 180;
  protected readonly MAX_TURN_RATE = 6; // Maximum degrees per frame (increased for easier control)
  protected readonly TURN_SPEED_PENALTY = 0.85; // Speed multiplier when turning (0.85 = 15% slower)
  protected readonly SCORE_PER_SEGMENT = 5; // Score needed per segment growth
  protected readonly INITIAL_SEGMENTS = 5; // Initial segment count
  protected readonly MAX_SEGMENTS = 100; // Maximum segments per snake

  onCreate(): void {
    this.setState(new SnakeGameState());
    this.state.tickRate = this.tickRate;
    this.state.worldBoundaryCollisions = true;

    this.onMessage('move', (client, message: { angle: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.alive) {
        player.angle = message.angle;
      }
    });

    this.onMessage('boost', (client, active: boolean) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.alive) {
        if (active && player.score >= 1) {
          player.boosting = true;
        } else {
          player.boosting = false;
        }
      }
    });

    this.onMessage('respawn', (client) => {
      this.respawnPlayer(client);
    });

    this.onMessage('eatFood', (client, message: { foodId: string }) => {
      const player = this.state.players.get(client.sessionId);
      const food = this.state.foods.get(message.foodId);

      if (!player || !player.alive || !food) {
        return;
      }

      const head = player.head;
      const dx = head.x - food.position.x;
      const dy = head.y - food.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const maxDistance = 250;

      if (distance <= maxDistance) {
        player.score += food.value;

        // 🔄 Sync segments to score after eating food
        this.syncSegmentsToScore(player);

        this.broadcast('foodConsumed', {
          id: message.foodId,
          playerId: player.id,
          value: food.value,
        });

        this.state.foods.delete(message.foodId);
        // ✅ FIX: Không spawn food tự động khi ăn - chỉ spawn khi snake chết
      }
    });

    // Generic message handler removed for performance

    this.onMessage(
      'playerDied',
      (client, message: { killerSessionId?: string | null }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) {
          return;
        }

        const killer = message.killerSessionId
          ? (this.state.players.get(message.killerSessionId) ?? undefined)
          : undefined;

        this.handleKillEvent(player, killer, { reason: 'client_message' });

        // Kill event handled
      },
    );

    this.initializeFood();

    // Initialize bots if needed
    this.manageBots();

    this.gameLoopInterval = this.clock.setInterval(() => {
      this.gameLoop();
    }, this.tickRate);

    // 🍎 Auto-respawn food every 2 seconds to keep food plentiful
    this.foodRespawnInterval = this.clock.setInterval(() => {
      const currentFoodCount = this.state.foods.size;
      const maxFoods = this.state.maxFoods;

      // Only spawn if below max
      if (currentFoodCount < maxFoods) {
        // Spawn 5-10 food per interval
        const foodsToSpawn = Math.min(
          Math.floor(Math.random() * 6) + 5,
          maxFoods - currentFoodCount,
        );

        for (let i = 0; i < foodsToSpawn; i++) {
          this.spawnFood();
        }
      }
    }, 2000); // Every 2 seconds
  }

  onJoin(client: Client, options: { name: string; skinId?: number }): void {
    const spawnPosition = this.getRandomPosition();
    const skinId = options.skinId !== undefined ? options.skinId : 0;
    const color = this.colors[skinId % this.colors.length];

    const player = new Player(
      client.sessionId,
      options.name || `Player ${client.sessionId.substr(0, 4)}`,
      spawnPosition.x,
      spawnPosition.y,
      color,
    );

    player.skinId = skinId;
    player.previousAngle = player.angle;
    player.currentTurnRate = 0;
    player.totalLength = player.segments.length; // 🔄 Sync totalLength on join

    this.state.players.set(client.sessionId, player);

    client.send('welcome', {
      id: client.sessionId,
      position: spawnPosition,
      color,
    });

    const initialFoods: Array<{
      id: string;
      position: { x: number; y: number };
      value: number;
    }> = [];
    this.state.foods.forEach((food, foodId) => {
      initialFoods.push({
        id: foodId,
        position: { x: food.position.x, y: food.position.y },
        value: food.value,
      });
    });

    client.send('initialFoods', { foods: initialFoods });
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    // Manage bots when real player leaves
    this.manageBots();
  }

  onDispose(): void {
    this.gameLoopInterval.clear();
    this.foodRespawnInterval.clear();
  }

  private lastBotManagementTime: number = 0;
  private readonly botManagementInterval: number = 5000; // Check every 5 seconds
  private botFoodCheckCounter: number = 0; // Counter to throttle bot food collision check

  protected gameLoop(): void {
    const currentTime = Date.now();

    this.state.players.forEach((player, playerId) => {
      if (!player.alive) {
        return;
      }

      // Update bot AI if this is a bot
      if (this.bots.has(playerId)) {
        const botAI = this.bots.get(playerId);
        if (botAI) {
          // Calculate new angle for bot
          const newAngle = botAI.calculateAngle(
            player,
            this.state.players,
            this.state.foods,
            this.state.worldWidth,
            this.state.worldHeight,
            currentTime,
          );
          player.angle = newAngle;

          // Handle bot boost (with current time for throttling)
          const shouldBoost = botAI.shouldBoost(
            player,
            this.state.players,
            currentTime,
          );
          if (shouldBoost && !player.boosting && player.score >= 1) {
            player.boosting = true;
          } else if (!shouldBoost) {
            player.boosting = false;
          }

          // ✅ FIX: Check food collision less frequently (every 2 frames) to match player behavior
          // Player only checks when client sends message, so bot shouldn't check every frame
          this.botFoodCheckCounter++;
          if (this.botFoodCheckCounter % 2 === 0) {
            this.checkBotFoodCollision(player);
          }
        }
      }

      this.movePlayer(player);
      this.checkWorldBoundaryCollision(player);
      this.checkPlayerCollisions(player);
    });

    // Manage bots periodically
    if (
      currentTime - this.lastBotManagementTime >=
      this.botManagementInterval
    ) {
      this.manageBots();
      this.lastBotManagementTime = currentTime;
    }

    // ✅ FIX: Đảm bảo luôn có đủ food để chơi
    // Nếu food quá ít (< 200), spawn thêm để đảm bảo game vẫn chơi được
    const currentFoodCount = this.state.foods.size;
    const minFoodThreshold = 200; // Tối thiểu 200 food để game vẫn chơi được (increased from 50)

    if (currentFoodCount < minFoodThreshold) {
      // Spawn thêm food để đạt minFoodThreshold
      const foodsToSpawn = minFoodThreshold - currentFoodCount;
      for (let i = 0; i < foodsToSpawn; i++) {
        this.spawnFood();
      }
    }
  }

  protected resolveBaseSpeed(player: Player): number {
    // Speed increases as player score increases
    const initialBaseSpeed = player.speed * 1.0; // 5.0 with default speed = 5 (increased from 0.75)
    const speedIncreasePerPoint = 0.01;
    const maxSpeed = 8.0; // Increased from 6.0
    return Math.min(
      initialBaseSpeed + player.score * speedIncreasePerPoint,
      maxSpeed,
    );
  }

  protected resolveNormalMultiplier(player: Player): number {
    // Normal speed multiplier is fixed to prevent exponential speed growth
    void player; // Unused parameter
    return 3.0; // Increased from 2.5
  }

  protected resolveBoostTargetMultiplier(
    player: Player,
    normalMultiplier: number,
  ): number {
    // Boost speed DECREASES as player gets bigger (penalty for large snakes)
    // but always maintains at least 1.5x normal speed
    const baseBoostMultiplier = 5.0; // High starting boost for small snakes
    const boostDecreasePerPoint = 0.001; // Decreases with score
    const minBoostMargin = 1.5; // Boost must be at least 1.5x normal speed

    const rawBoostMultiplier =
      baseBoostMultiplier - player.score * boostDecreasePerPoint;
    const minimumBoostMultiplier = normalMultiplier * minBoostMargin;

    return Math.max(rawBoostMultiplier, minimumBoostMultiplier);
  }

  protected movePlayer(player: Player): void {
    if (!player.alive || player.segments.length === 0) {
      return;
    }

    // 🎯 Apply turn rate limiting
    const targetAngle = player.angle;
    let angleDelta = targetAngle - player.previousAngle;

    // Normalize angle delta to [-180, 180] range
    while (angleDelta > 180) angleDelta -= 360;
    while (angleDelta < -180) angleDelta += 360;

    // Clamp angle delta to MAX_TURN_RATE
    const clampedDelta = Math.max(
      -this.MAX_TURN_RATE,
      Math.min(this.MAX_TURN_RATE, angleDelta),
    );

    // Apply limited angle change
    player.angle = player.previousAngle + clampedDelta;

    // Normalize final angle to [0, 360] range
    while (player.angle < 0) player.angle += 360;
    while (player.angle >= 360) player.angle -= 360;

    // Track turn rate for collision detection
    player.currentTurnRate = Math.abs(clampedDelta);
    player.previousAngle = player.angle;

    const head = player.segments[0];
    const angleRad = player.angle * this.degreeToRadian;
    const baseSpeed = this.resolveBaseSpeed(player);
    const normalMultiplier = this.resolveNormalMultiplier(player);
    const boostTargetMultiplier = this.resolveBoostTargetMultiplier(
      player,
      normalMultiplier,
    );

    if (player.boosting) {
      player.boostTime += this.tickRate;

      // 🍎 Spawn food trail while boosting
      this.spawnBoostFood(player, Date.now());

      if (player.boostTime >= 500) {
        player.boostTime = 0;

        if (player.segments.length > this.INITIAL_SEGMENTS) {
          // 🔥 Boost penalty: -10 points every 500ms (increased from -1)
          player.score = Math.max(0, player.score - 10);

          // 🔄 Sync segments to score after boost penalty
          this.syncSegmentsToScore(player);

          // Stop boosting if reached minimum segments
          if (player.segments.length <= this.INITIAL_SEGMENTS) {
            player.boosting = false;
          }
        } else {
          player.boosting = false;
        }
      }
    } else {
      player.boostTime = 0;
    }

    let speedMultiplier = player.boosting
      ? boostTargetMultiplier
      : normalMultiplier;

    // 🎮 Apply speed penalty when turning (makes control harder)
    const isTurning = player.currentTurnRate > 1; // Threshold for considering as turning
    if (isTurning) {
      speedMultiplier *= this.TURN_SPEED_PENALTY;
    }

    const dx = Math.cos(angleRad) * baseSpeed * speedMultiplier;
    const dy = Math.sin(angleRad) * baseSpeed * speedMultiplier;

    // Allow snake to move freely (boundary collision will be checked separately)
    const newX = head.position.x + dx;
    const newY = head.position.y + dy;

    for (let index = player.segments.length - 1; index > 0; index -= 1) {
      const segment = player.segments[index];
      const previousSegment = player.segments[index - 1];

      segment.position.x = previousSegment.position.x;
      segment.position.y = previousSegment.position.y;
    }

    head.position.x = newX;
    head.position.y = newY;

    player.updateHeadPosition();
  }

  protected checkWorldBoundaryCollision(player: Player): void {
    if (!player.alive || player.invulnerable) {
      return;
    }

    if (!this.state.worldBoundaryCollisions) {
      return;
    }

    const head = player.segments[0];
    if (!head) {
      return;
    }

    // Check if head is outside world boundaries
    const headRadius = 8; // Base head radius for collision detection
    const isOutOfBounds =
      head.position.x < headRadius ||
      head.position.x >= this.state.worldWidth - headRadius ||
      head.position.y < headRadius ||
      head.position.y >= this.state.worldHeight - headRadius;

    if (isOutOfBounds) {
      this.handleKillEvent(player, undefined, { reason: 'wall_collision' });
    }
  }

  protected checkPlayerCollisions(player: Player): void {
    if (!player.alive || player.invulnerable) {
      return;
    }

    const head = player.segments[0];
    if (!head) {
      return;
    }

    // 🚀 PERFORMANCE: Pre-calculate collision radius once
    // 🎮 Increased collision risk when turning (makes control harder)
    const baseHeadRadius = 8;
    const turnRateMultiplier =
      1 + (player.currentTurnRate / this.MAX_TURN_RATE) * 1.5;
    const headRadius = baseHeadRadius * turnRateMultiplier;
    const segmentRadius = 6;
    const collisionThreshold = headRadius + segmentRadius;
    const collisionThresholdSq = collisionThreshold * collisionThreshold;

    // 🚀 PERFORMANCE: Only check segments within this distance from player head
    const maxCheckDistance = 200;
    const maxCheckDistanceSq = maxCheckDistance * maxCheckDistance;

    this.state.players.forEach((otherPlayer, otherPlayerId) => {
      if (otherPlayerId === player.id || !otherPlayer.alive) {
        return;
      }

      // ✅ FIX: Check each segment individually instead of checking head distance first
      // This prevents the bug where snakes can pass through long snake bodies
      // when the heads are far apart but bodies are close
      for (let index = 1; index < otherPlayer.segments.length; index += 1) {
        const segment = otherPlayer.segments[index];
        const dx = head.position.x - segment.position.x;
        const dy = head.position.y - segment.position.y;
        const distanceSq = dx * dx + dy * dy;

        // 🚀 PERFORMANCE: Only check collision if segment is within range
        if (distanceSq <= maxCheckDistanceSq) {
          if (distanceSq < collisionThresholdSq) {
            this.handleKillEvent(player, otherPlayer, { reason: 'collision' });
            return; // Exit immediately after collision
          }
        }
      }
    });
  }

  protected killPlayer(player: Player): void {
    player.alive = false;
    this.broadcast('playerDied', { playerId: player.id });
  }

  protected respawnPlayer(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    const spawnPosition = this.getRandomPosition();
    player.alive = true;
    player.score = 0;
    player.kills = 0;
    player.segments.clear();
    player.previousAngle = player.angle;
    player.currentTurnRate = 0;

    player.invulnerable = true;

    this.clock.setTimeout(() => {
      if (player) {
        player.invulnerable = false;
      }
    }, 3000);

    for (let index = 0; index < this.INITIAL_SEGMENTS; index += 1) {
      player.segments.push(
        new SnakeSegment(spawnPosition.x - index * 20, spawnPosition.y),
      );
    }
    player.totalLength = this.INITIAL_SEGMENTS; // 🔄 Sync totalLength after respawn
  }

  protected spawnFoodFromDeadPlayer(player: Player, score: number): void {
    // 🍎 Only return 10% of score as food (reduced from 100%)
    // This makes deaths less rewarding and encourages survival

    if (score <= 0) {
      return; // No score = no food spawn
    }

    // ✅ FIX: Save segments positions immediately before they might be cleared
    const segmentPositions: Array<{ x: number; y: number }> = [];
    const segmentCount = player.segments.length;

    // If segments exist, save their positions
    if (segmentCount > 0) {
      for (let i = 0; i < segmentCount; i++) {
        const segment = player.segments[i];
        if (segment && segment.position) {
          segmentPositions.push({
            x: segment.position.x,
            y: segment.position.y,
          });
        }
      }
    }

    // If no segments saved, use headPosition as fallback
    if (segmentPositions.length === 0 && player.headPosition) {
      segmentPositions.push({
        x: player.headPosition.x,
        y: player.headPosition.y,
      });
    }

    // If still no positions, can't spawn food
    if (segmentPositions.length === 0) {
      return;
    }

    // 🔥 BALANCE: Only spawn 10% of score as food (90% reduction)
    // Max 20 foods per death to prevent lag and reduce rewards
    const MAX_FOOD_DROP = 20; // Reduced from 200
    const foodFromScore = Math.max(1, Math.floor(score * 0.1)); // 10% of score, min 1
    const foodToSpawn = Math.min(foodFromScore, MAX_FOOD_DROP);

    // 🚀 PERFORMANCE: Progressive spawn in batches to reduce instant load
    const BATCH_SIZE = 20; // Spawn 20 foods at a time
    const BATCH_DELAY = 30; // 30ms delay between batches

    for (
      let batchIndex = 0;
      batchIndex < Math.ceil(foodToSpawn / BATCH_SIZE);
      batchIndex += 1
    ) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, foodToSpawn);

      // Schedule batch spawn with delay
      this.clock.setTimeout(() => {
        for (let index = batchStart; index < batchEnd; index += 1) {
          // Use evenly distributed segments to sample from the snake
          const segmentIndex = Math.floor(
            (index / foodToSpawn) * segmentPositions.length,
          );
          const segmentPos =
            segmentPositions[segmentIndex] || segmentPositions[0];

          if (!segmentPos) continue;

          // Generate unique food ID
          const foodId = `food_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;

          // Spawn food at segment position with slight random offset for visual variety
          const offsetRange = 20; // Slightly larger offset for better spread
          const foodX =
            segmentPos.x + (Math.random() * offsetRange * 2 - offsetRange);
          const foodY =
            segmentPos.y + (Math.random() * offsetRange * 2 - offsetRange);

          // Create food with value 1 (normal food)
          const food = new Food(foodId, foodX, foodY, 1);

          // Add to game state (không kiểm tra maxFoods - đơn giản là thêm vào)
          this.state.foods.set(foodId, food);

          // Broadcast to all clients to spawn food
          this.broadcast('foodSpawned', {
            id: foodId,
            position: { x: foodX, y: foodY },
            value: 1,
          });
        }
      }, batchIndex * BATCH_DELAY);
    }
  }

  protected initializeFood(): void {
    for (let index = 0; index < this.state.maxFoods; index += 1) {
      this.spawnFood();
    }
  }

  protected spawnFood(): void {
    const position = this.getRandomPosition();
    const foodId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const value = Math.random() < 0.1 ? 5 : 1; // 10% special food (increased from 5%)

    const food = new Food(foodId, position.x, position.y, value);
    this.state.foods.set(foodId, food);

    this.broadcast('foodSpawned', {
      id: foodId,
      position: { x: position.x, y: position.y },
      value,
    });
  }

  /**
   * 🍎 Spawn food when player is boosting
   * Creates a food trail behind the snake
   */
  protected spawnBoostFood(player: Player, currentTime: number): void {
    const BOOST_FOOD_INTERVAL = 150; // Spawn food every 150ms while boosting

    // Check if enough time has passed since last spawn
    if (currentTime - player.lastBoostFoodSpawnTime < BOOST_FOOD_INTERVAL) {
      return;
    }

    // Get tail segment position (last segment)
    const tailSegment = player.segments[player.segments.length - 1];
    if (!tailSegment) {
      return;
    }

    // Generate food at tail position with small random offset
    const offsetRange = 10;
    const foodX =
      tailSegment.position.x + (Math.random() * offsetRange * 2 - offsetRange);
    const foodY =
      tailSegment.position.y + (Math.random() * offsetRange * 2 - offsetRange);
    const foodId = `boost_food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const food = new Food(foodId, foodX, foodY, 1); // Always value 1 for boost food
    this.state.foods.set(foodId, food);

    this.broadcast('foodSpawned', {
      id: foodId,
      position: { x: foodX, y: foodY },
      value: 1,
    });

    // Update last spawn time
    player.lastBoostFoodSpawnTime = currentTime;
  }

  protected getRandomPosition(): { x: number; y: number } {
    return {
      x: Math.random() * this.state.worldWidth,
      y: Math.random() * this.state.worldHeight,
    };
  }

  protected clampCoordinate(value: number, max: number): number {
    return Math.max(0, Math.min(value, max));
  }

  /**
   * 🔄 Sync player segments to match their score
   * Formula: segments = INITIAL_SEGMENTS + floor(score / SCORE_PER_SEGMENT)
   * 🎯 Limited to MAX_SEGMENTS to prevent performance issues
   */
  protected syncSegmentsToScore(player: Player): void {
    const targetSegmentCount = Math.min(
      this.MAX_SEGMENTS,
      this.INITIAL_SEGMENTS + Math.floor(player.score / this.SCORE_PER_SEGMENT),
    );
    const currentSegmentCount = player.segments.length;

    if (targetSegmentCount > currentSegmentCount) {
      // Add segments (but not exceed MAX_SEGMENTS)
      const segmentsToAdd = targetSegmentCount - currentSegmentCount;
      for (let index = 0; index < segmentsToAdd; index += 1) {
        if (player.segments.length < this.MAX_SEGMENTS) {
          player.addSegment();
        }
      }
    } else if (targetSegmentCount < currentSegmentCount) {
      // Remove segments
      const segmentsToRemove = currentSegmentCount - targetSegmentCount;
      for (let index = 0; index < segmentsToRemove; index += 1) {
        if (player.segments.length > this.INITIAL_SEGMENTS) {
          player.segments.pop();
          player.totalLength = player.segments.length;
        }
      }
    }
  }

  protected wrapCoordinate(value: number, max: number): number {
    if (value < 0) {
      return max + (value % max);
    }
    if (value >= max) {
      return value % max;
    }
    return value;
  }

  protected getKillerSessionId(deadPlayerSessionId: string): string | null {
    const deadPlayer = this.state.players.get(deadPlayerSessionId);
    if (!deadPlayer) {
      return null;
    }

    const headPosition = deadPlayer.segments[0].position;
    const collisionRadius = 10;

    for (const [sessionId, player] of this.state.players.entries()) {
      if (sessionId === deadPlayerSessionId) {
        continue;
      }

      for (let index = 1; index < player.segments.length; index += 1) {
        const segment = player.segments[index];
        const dx = headPosition.x - segment.position.x;
        const dy = headPosition.y - segment.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < collisionRadius + 8) {
          return sessionId;
        }
      }
    }

    return null;
  }

  protected handleKillEvent(
    victim: Player,
    killer?: Player,
    context?: { reason?: string },
  ): void {
    // ✅ FIX: Save score before killing player (score might be reset)
    const victimScore = victim.score;

    this.killPlayer(victim);

    if (killer) {
      // Killer only gets kill count, not score
      killer.kills += 1;

      this.broadcast('playerKilled', {
        killed: victim.id,
        killer: killer.id,
      });
    }

    // Convert victim's score to food at death location
    // Use saved score instead of victim.score (might be 0 after kill)
    if (victimScore > 0) {
      this.spawnFoodFromDeadPlayer(victim, victimScore);
    }

    this.afterKillProcessed(victim, killer, context);
  }

  protected afterKillProcessed(
    victim: Player,
    killer?: Player,
    context?: { reason?: string },
  ): void {
    void victim;
    void killer;
    void context;

    // Respawn bot if it was killed
    if (this.bots.has(victim.id)) {
      this.clock.setTimeout(() => {
        this.respawnBot(victim.id);
      }, 2000); // Respawn after 2 seconds
    }
  }

  /**
   * Manage bot population - spawn exactly 3 bots per game
   */
  protected manageBots(): void {
    const realPlayerCount = this.clients.length;

    // Count only alive bots
    let aliveBotCount = 0;
    this.bots.forEach((_, botId) => {
      const bot = this.state.players.get(botId);
      if (bot && bot.alive) {
        aliveBotCount++;
      }
    });

    const currentBotCount = this.bots.size;

    // Only add bots if we have minimum real players
    if (realPlayerCount < this.minPlayersForBots) {
      // Remove all bots if no real players
      this.removeAllBots();
      return;
    }

    // Spawn bots to reach target (3 bots)
    if (aliveBotCount < this.targetBots) {
      const botsNeeded = this.targetBots - aliveBotCount;
      const canAddBots = Math.min(botsNeeded, this.maxBots - currentBotCount);

      // Add bots if needed and within limit
      if (canAddBots > 0) {
        for (let i = 0; i < canAddBots; i++) {
          this.spawnBot();
        }
      }
    } else if (aliveBotCount > this.targetBots) {
      // Remove excess bots if more than 3 (only remove alive bots)
      const excessBots = aliveBotCount - this.targetBots;
      const botIds = Array.from(this.bots.keys());
      let removedCount = 0;

      for (const botId of botIds) {
        if (removedCount >= excessBots) break;

        const bot = this.state.players.get(botId);
        if (bot && bot.alive) {
          this.removeBot(botId);
          removedCount++;
        }
      }
    }

    // Clean up bots that are no longer in state (shouldn't happen, but safety check)
    const botIdsToRemove: string[] = [];
    this.bots.forEach((_, botId) => {
      const bot = this.state.players.get(botId);
      if (!bot) {
        // Bot was removed from state but still in bots map - cleanup
        botIdsToRemove.push(botId);
      }
    });

    botIdsToRemove.forEach((botId) => {
      // Get bot name before removing from bots map
      const bot = this.state.players.get(botId);
      if (bot) {
        this.usedBotNames.delete(bot.name);
      }
      this.bots.delete(botId);
    });
  }

  /**
   * Spawn a new bot
   */
  protected spawnBot(): void {
    // Generate unique bot ID
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get unused bot name
    const availableNames = this.botNames.filter(
      (name) => !this.usedBotNames.has(name),
    );
    if (availableNames.length === 0) {
      // Reset if all names used
      this.usedBotNames.clear();
    }
    const botName =
      availableNames[Math.floor(Math.random() * availableNames.length)] ||
      this.botNames[0];
    this.usedBotNames.add(botName);

    // Spawn position
    const spawnPosition = this.getRandomPosition();
    const skinId = Math.floor(Math.random() * this.colors.length);
    const color = this.colors[skinId];

    // Create bot player
    const bot = new Player(
      botId,
      botName,
      spawnPosition.x,
      spawnPosition.y,
      color,
    );

    bot.skinId = skinId;
    bot.previousAngle = bot.angle;
    bot.currentTurnRate = 0;
    bot.totalLength = bot.segments.length;
    bot.angle = Math.random() * 360; // Random initial direction

    // Add to game state
    this.state.players.set(botId, bot);

    // Create bot AI with pro player settings (optimized for survival and killing)
    const botAI = new BotAI({
      detectionRange: 600, // Very good detection (pro players see threats early)
      foodSeekRange: 1000, // Look far for food (pro players plan ahead)
      wallAvoidanceDistance: 500, // Much earlier wall avoidance (increased for better survival)
      minPlayerDistance: 350, // Safe distance (pro players keep safe)
    });
    this.bots.set(botId, botAI);

    // Broadcast bot join (optional, can be silent)
    this.broadcast('welcome', {
      id: botId,
      position: spawnPosition,
      color,
    });
  }

  /**
   * Remove a bot
   */
  protected removeBot(botId: string): void {
    const bot = this.state.players.get(botId);
    if (bot) {
      // Free up bot name
      this.usedBotNames.delete(bot.name);

      // Remove from game state
      this.state.players.delete(botId);

      // Remove AI
      this.bots.delete(botId);
    }
  }

  /**
   * Remove all bots
   */
  protected removeAllBots(): void {
    const botIds = Array.from(this.bots.keys());
    botIds.forEach((botId) => {
      this.removeBot(botId);
    });
  }

  /**
   * Check if bot can eat food and handle it automatically
   * ✅ FIX: Use same collision distance as player and check less frequently
   */
  protected checkBotFoodCollision(bot: Player): void {
    if (!bot.alive) {
      return;
    }

    const head = bot.head;
    const maxDistance = 250; // Same as player food collision distance (EXACTLY the same)

    this.state.foods.forEach((food, foodId) => {
      const dx = head.x - food.position.x;
      const dy = head.y - food.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // ✅ FIX: Use exact same distance check as player (<= 250)
      if (distance <= maxDistance) {
        // Bot eats the food
        bot.score += food.value;

        // Sync segments to score after eating food
        this.syncSegmentsToScore(bot);

        this.broadcast('foodConsumed', {
          id: foodId,
          playerId: bot.id,
          value: food.value,
        });

        this.state.foods.delete(foodId);
        // ✅ FIX: Không spawn food tự động khi bot ăn - chỉ spawn khi snake chết
        return; // Exit after eating one food (same as player behavior)
      }
    });
  }

  /**
   * Respawn a dead bot
   */
  protected respawnBot(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot || !this.bots.has(botId)) {
      return;
    }

    const spawnPosition = this.getRandomPosition();
    bot.alive = true;
    bot.score = 0;
    bot.kills = 0;
    bot.segments.clear();
    bot.previousAngle = bot.angle;
    bot.currentTurnRate = 0;
    bot.angle = Math.random() * 360; // Random direction
    bot.invulnerable = true;

    // Remove invulnerability after 3 seconds
    this.clock.setTimeout(() => {
      if (bot) {
        bot.invulnerable = false;
      }
    }, 3000);

    // Recreate segments
    for (let index = 0; index < this.INITIAL_SEGMENTS; index += 1) {
      bot.segments.push(
        new SnakeSegment(spawnPosition.x - index * 20, spawnPosition.y),
      );
    }
    bot.totalLength = this.INITIAL_SEGMENTS;
    bot.headPosition.x = spawnPosition.x;
    bot.headPosition.y = spawnPosition.y;
  }
}
