import { Client, Delayed, Room } from '@colyseus/core';
import { Food, Player, SnakeGameState, SnakeSegment } from './schema';

export class FreeGameRoom extends Room<SnakeGameState> {
  maxClients = 20;
  tickRate = 16;
  gameLoopInterval: Delayed;

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
      console.log(
        `Player ${client.sessionId} attempting to eat food ${message.foodId}`,
      );

      const player = this.state.players.get(client.sessionId);
      const food = this.state.foods.get(message.foodId);

      if (!player || !player.alive) {
        console.log(`Player ${client.sessionId} is not valid or not alive`);
        return;
      }

      if (!food) {
        console.log(`Food ${message.foodId} does not exist`);
        return;
      }

      const head = player.head;
      const dx = head.x - food.position.x;
      const dy = head.y - food.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      console.log(`Distance to food: ${distance}`);

      const maxDistance = 250;

      if (distance <= maxDistance) {
        console.log(
          `Player ${client.sessionId} eating food ${message.foodId}, value: ${food.value}`,
        );

        player.score += food.value;
        console.log(`New score: ${player.score}`);

        const segmentsToAdd = food.value > 1 ? 3 : 1;
        for (let index = 0; index < segmentsToAdd; index += 1) {
          player.addSegment();
        }

        this.broadcast('foodConsumed', {
          id: message.foodId,
          playerId: player.id,
          value: food.value,
        });

        this.state.foods.delete(message.foodId);
        this.spawnFood();
      } else {
        console.log(`Food too far away (${distance} > ${maxDistance})`);
      }
    });

    this.onMessage('*', (_, type) => {
      console.log(`Received message of type: ${type}`);
    });

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

        if (message.killerSessionId) {
          console.log(
            `Broadcasting kill event: ${message.killerSessionId} killed ${player.id}`,
          );
        }
      },
    );

    this.initializeFood();

    this.gameLoopInterval = this.clock.setInterval(() => {
      this.gameLoop();
    }, this.tickRate);
  }

  onJoin(client: Client, options: { name: string; skinId?: number }): void {
    console.log(`${client.sessionId} joined with options:`, options);

    const spawnPosition = this.getRandomPosition();
    const skinId = options.skinId !== undefined ? options.skinId : 0;
    const color = this.colors[skinId % this.colors.length];

    console.log(
      `Spawning player at position: ${spawnPosition.x}, ${spawnPosition.y} with color: ${color} and skin: ${skinId}`,
    );

    const player = new Player(
      client.sessionId,
      options.name || `Player ${client.sessionId.substr(0, 4)}`,
      spawnPosition.x,
      spawnPosition.y,
      color,
    );

    player.skinId = skinId;

    this.state.players.set(client.sessionId, player);
    console.log(
      `Player created with ID: ${client.sessionId}, segments: ${player.segments.length}`,
    );

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
    console.log(`${client.sessionId} left!`);
    this.state.players.delete(client.sessionId);
  }

  onDispose(): void {
    console.log('Room disposed!');
    this.gameLoopInterval.clear();
  }

  protected gameLoop(): void {
    const start = performance.now();

    this.state.players.forEach((player) => {
      if (!player.alive) {
        return;
      }

      this.movePlayer(player);
      this.checkPlayerCollisions(player);
    });

    if (this.state.foods.size < this.state.maxFoods) {
      this.spawnFood();
    }

    const end = performance.now();
    console.log(`Game loop took ${end - start} milliseconds`);
  }

  protected resolveBaseSpeed(player: Player): number {
    // Speed increases as player score increases
    const initialBaseSpeed = player.speed * 0.75; // 3.75 with default speed = 5
    const speedIncreasePerPoint = 0.01;
    const maxSpeed = 6.0;
    
    return Math.min(
      initialBaseSpeed + player.score * speedIncreasePerPoint,
      maxSpeed
    );
  }

  protected resolveNormalMultiplier(player: Player): number {
    // Normal speed multiplier increases slightly as player score increases
    const normalMultiplierBase = 2.2;
    const multiplierIncreasePerPoint = 0.002;
    const maxNormalMultiplier = 2.8;

    return Math.min(
      normalMultiplierBase + player.score * multiplierIncreasePerPoint,
      maxNormalMultiplier
    );
  }

  protected resolveBoostTargetMultiplier(
    player: Player,
    normalMultiplier: number,
  ): number {
    // Boost speed multiplier increases slightly as player score increases
    const baseBoostMultiplier = 5.0;
    const boostIncreasePerPoint = 0.005;
    const maxBoostMultiplier = 6.5;
    const minBoostMargin = 0.8; // Boost must be faster than normal by at least this margin

    const rawBoostMultiplier = Math.min(
      baseBoostMultiplier + player.score * boostIncreasePerPoint,
      maxBoostMultiplier
    );

    const minimumBoostMultiplier = normalMultiplier + minBoostMargin;

    return Math.max(minimumBoostMultiplier, rawBoostMultiplier);
  }

  protected movePlayer(player: Player): void {
    if (!player.alive || player.segments.length === 0) {
      return;
    }

    const head = player.segments[0];
    const angleRad = player.angle * this.degreeToRadian;
    const baseSpeed = this.resolveBaseSpeed(player);
    const normalMultiplier = this.resolveNormalMultiplier(player);
    const boostTargetMultiplier = this.resolveBoostTargetMultiplier(player, normalMultiplier);

    if (player.boosting) {
      player.boostTime += this.tickRate;

      if (player.boostTime >= 500) {
        player.boostTime = 0;

        if (player.segments.length > 5) {
          player.score = Math.max(0, player.score - 1);

          if (player.segments.length > 5) {
            player.segments.pop();
          } else {
            player.boosting = false;
          }
        } else {
          player.boosting = false;
        }
      }
    } else {
      player.boostTime = 0;
    }

    const speedMultiplier = player.boosting
      ? boostTargetMultiplier
      : normalMultiplier;

    const dx = Math.cos(angleRad) * baseSpeed * speedMultiplier;
    const dy = Math.sin(angleRad) * baseSpeed * speedMultiplier;

    const newX = this.wrapCoordinate(
      head.position.x + dx,
      this.state.worldWidth,
    );
    const newY = this.wrapCoordinate(
      head.position.y + dy,
      this.state.worldHeight,
    );

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

  protected checkPlayerCollisions(player: Player): void {
    if (!player.alive) {
      return;
    }

    const head = player.segments[0];
    if (!head) {
      return;
    }

    this.state.players.forEach((otherPlayer, otherPlayerId) => {
      if (otherPlayerId === player.id || !otherPlayer.alive) {
        return;
      }

      if (player.invulnerable) {
        return;
      }

      for (let index = 1; index < otherPlayer.segments.length; index += 1) {
        const segment = otherPlayer.segments[index];
        const dx = head.position.x - segment.position.x;
        const dy = head.position.y - segment.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const headRadius = 8;
        const segmentRadius = 6;

        if (distance < headRadius + segmentRadius) {
          this.handleKillEvent(player, otherPlayer, { reason: 'collision' });
          return;
        }
      }
    });

    if (this.state.worldBoundaryCollisions) {
      if (
        head.position.x < 0 ||
        head.position.x > this.state.worldWidth ||
        head.position.y < 0 ||
        head.position.y > this.state.worldHeight
      ) {
        this.handleKillEvent(player, undefined, { reason: 'boundary' });
      }
    }
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

    player.invulnerable = true;

    this.clock.setTimeout(() => {
      if (player) {
        player.invulnerable = false;
      }
    }, 3000);

    const initialSegments = 5;
    for (let index = 0; index < initialSegments; index += 1) {
      player.segments.push(
        new SnakeSegment(spawnPosition.x - index * 20, spawnPosition.y),
      );
    }
  }

  protected spawnFoodFromDeadPlayer(player: Player): void {
    // 🍎 Spawn food based on snake segments (optimized for performance)
    const segmentCount = player.segments.length;

    // 🔥 PERFORMANCE FIX: Limit max food drops to prevent lag
    const MAX_FOOD_DROP = 30; // Maximum 30 foods per death
    const foodToSpawn = Math.min(segmentCount, MAX_FOOD_DROP);

    console.log(
      `[🍎] [FreeGameRoom] [spawnFoodFromDeadPlayer] Player ${player.name} died with ${segmentCount} segments. Spawning ${foodToSpawn} foods`,
    );

    // 🚀 PERFORMANCE FIX: Progressive spawn in batches to reduce instant load
    const BATCH_SIZE = 10; // Spawn 10 foods at a time
    const BATCH_DELAY = 50; // 50ms delay between batches

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
          const segmentIndex = Math.floor((index / foodToSpawn) * segmentCount);
          const segment = player.segments[segmentIndex];

          if (!segment) continue;

          // Generate unique food ID
          const foodId = `food_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;

          // Spawn food at segment position with slight random offset for visual variety
          const offsetRange = 20; // Slightly larger offset for better spread
          const foodX =
            segment.position.x +
            (Math.random() * offsetRange * 2 - offsetRange);
          const foodY =
            segment.position.y +
            (Math.random() * offsetRange * 2 - offsetRange);

          // Create food with value 1 (normal food)
          const food = new Food(foodId, foodX, foodY, 1);

          // Add to game state
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

    console.log(
      `[✅] [FreeGameRoom] [spawnFoodFromDeadPlayer] Scheduled ${foodToSpawn} foods in ${Math.ceil(foodToSpawn / BATCH_SIZE)} batches`,
    );
  }

  protected initializeFood(): void {
    for (let index = 0; index < this.state.maxFoods; index += 1) {
      this.spawnFood();
    }
  }

  protected spawnFood(): void {
    const position = this.getRandomPosition();
    const foodId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const value = Math.random() < 0.05 ? 5 : 1;

    const food = new Food(foodId, position.x, position.y, value);
    this.state.foods.set(foodId, food);

    this.broadcast('foodSpawned', {
      id: foodId,
      position: { x: position.x, y: position.y },
      value,
    });
  }

  protected getRandomPosition(): { x: number; y: number } {
    return {
      x: Math.random() * this.state.worldWidth,
      y: Math.random() * this.state.worldHeight,
    };
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
    this.killPlayer(victim);

    if (killer) {
      killer.score += Math.floor(victim.score / 2);
      killer.kills += 1;

      this.broadcast('playerKilled', {
        killed: victim.id,
        killer: killer.id,
      });
    }

    this.spawnFoodFromDeadPlayer(victim);
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
  }
}
