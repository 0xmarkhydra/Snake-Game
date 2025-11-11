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

  protected movePlayer(player: Player): void {
    if (!player.alive || player.segments.length === 0) {
      return;
    }

    const head = player.segments[0];
    const angleRad = player.angle * this.degreeToRadian;
    const speedMultiplier = player.boosting ? 6 : 3;

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

    const dx = Math.cos(angleRad) * player.speed * speedMultiplier;
    const dy = Math.sin(angleRad) * player.speed * speedMultiplier;

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
    const foodPerSegment = Math.min(Math.floor(player.segments.length / 3), 20);

    for (let index = 0; index < foodPerSegment; index += 1) {
      const segmentIndex = Math.floor(Math.random() * player.segments.length);
      const segment = player.segments[segmentIndex];

      const foodId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const foodX = segment.position.x + (Math.random() * 40 - 20);
      const foodY = segment.position.y + (Math.random() * 40 - 20);

      const food = new Food(foodId, foodX, foodY, 1);

      this.state.foods.set(foodId, food);

      this.broadcast('foodSpawned', {
        id: foodId,
        position: { x: foodX, y: foodY },
        value: 1,
      });
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
