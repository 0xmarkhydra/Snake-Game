import { Player, Food } from './rooms/schema';

export interface BotConfig {
  detectionRange: number; // Range to detect players and run away
  foodSeekRange: number; // Range to seek food
  wallAvoidanceDistance: number; // Distance from wall to start avoiding
  minPlayerDistance: number; // Minimum safe distance from players
}

export class BotAI {
  private readonly config: BotConfig;
  private targetFoodId: string | null = null;
  private fleeTarget: { x: number; y: number } | null = null;
  private lastDecisionTime: number = 0;
  private decisionInterval: number = 100; // Make decision every 100ms

  constructor(config?: Partial<BotConfig>) {
    this.config = {
      detectionRange: config?.detectionRange ?? 400,
      foodSeekRange: config?.foodSeekRange ?? 600,
      wallAvoidanceDistance: config?.wallAvoidanceDistance ?? 200,
      minPlayerDistance: config?.minPlayerDistance ?? 250,
      ...config,
    };
  }

  /**
   * Calculate the angle the bot should move towards
   */
  calculateAngle(
    bot: Player,
    allPlayers: Map<string, Player>,
    allFoods: Map<string, Food>,
    worldWidth: number,
    worldHeight: number,
    currentTime: number,
  ): number {
    // Throttle decision making for performance
    if (currentTime - this.lastDecisionTime < this.decisionInterval) {
      return bot.angle; // Keep current angle
    }
    this.lastDecisionTime = currentTime;

    const headX = bot.headPosition.x;
    const headY = bot.headPosition.y;

    // Priority 1: Check for nearby players and flee if too close
    const nearbyPlayer = this.findNearestPlayer(
      bot,
      allPlayers,
      headX,
      headY,
    );
    if (nearbyPlayer) {
      const fleeAngle = this.calculateFleeAngle(
        headX,
        headY,
        nearbyPlayer.headPosition.x,
        nearbyPlayer.headPosition.y,
      );
      this.fleeTarget = { x: nearbyPlayer.headPosition.x, y: nearbyPlayer.headPosition.y };
      return fleeAngle;
    }
    this.fleeTarget = null;

    // Priority 2: Avoid walls
    const wallAvoidanceAngle = this.avoidWalls(
      headX,
      headY,
      worldWidth,
      worldHeight,
      bot.angle,
    );
    if (wallAvoidanceAngle !== null) {
      return wallAvoidanceAngle;
    }

    // Priority 3: Seek food
    const foodAngle = this.seekFood(bot, allFoods, headX, headY);
    if (foodAngle !== null) {
      return foodAngle;
    }

    // Default: Continue in current direction or random movement
    return bot.angle;
  }

  /**
   * Find the nearest player within detection range
   */
  private findNearestPlayer(
    bot: Player,
    allPlayers: Map<string, Player>,
    headX: number,
    headY: number,
  ): Player | null {
    let nearestPlayer: Player | null = null;
    let nearestDistance = this.config.detectionRange;

    allPlayers.forEach((player, playerId) => {
      if (playerId === bot.id || !player.alive) {
        return;
      }

      // Check if player is bigger than bot (more dangerous)
      const isPlayerBigger = player.segments.length > bot.segments.length;
      const isPlayerSameSize = player.segments.length === bot.segments.length;

      // Only flee from bigger or same-size players
      if (!isPlayerBigger && !isPlayerSameSize) {
        return;
      }

      const dx = player.headPosition.x - headX;
      const dy = player.headPosition.y - headY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPlayer = player;
      }
    });

    return nearestPlayer;
  }

  /**
   * Calculate angle to flee from a player
   */
  private calculateFleeAngle(
    botX: number,
    botY: number,
    playerX: number,
    playerY: number,
  ): number {
    // Calculate direction away from player
    const dx = botX - playerX;
    const dy = botY - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      // If exactly on top, pick random direction
      return Math.random() * 360;
    }

    // Calculate angle away from player
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    angle = (angle + 360) % 360; // Normalize to [0, 360)

    return angle;
  }

  /**
   * Avoid walls by adjusting angle
   */
  private avoidWalls(
    headX: number,
    headY: number,
    worldWidth: number,
    worldHeight: number,
    currentAngle: number,
  ): number | null {
    const avoidDist = this.config.wallAvoidanceDistance;
    
    // Check each wall and adjust angle if too close
    const distToLeft = headX;
    const distToRight = worldWidth - headX;
    const distToTop = headY;
    const distToBottom = worldHeight - headY;

    let newAngle = currentAngle;
    let needsAdjustment = false;

    // Calculate safe direction away from walls
    // Priority: avoid closest wall first
    
    // Check corners first (most dangerous)
    if (distToLeft < avoidDist && distToTop < avoidDist) {
      // Top-left corner - move down-right
      newAngle = 45;
      needsAdjustment = true;
    } else if (distToRight < avoidDist && distToTop < avoidDist) {
      // Top-right corner - move down-left
      newAngle = 135;
      needsAdjustment = true;
    } else if (distToLeft < avoidDist && distToBottom < avoidDist) {
      // Bottom-left corner - move up-right
      newAngle = 315;
      needsAdjustment = true;
    } else if (distToRight < avoidDist && distToBottom < avoidDist) {
      // Bottom-right corner - move up-left
      newAngle = 225;
      needsAdjustment = true;
    }
    // Check individual walls
    else if (distToLeft < avoidDist) {
      // Left wall - move right (0 degrees)
      newAngle = 0;
      needsAdjustment = true;
    } else if (distToRight < avoidDist) {
      // Right wall - move left (180 degrees)
      newAngle = 180;
      needsAdjustment = true;
    } else if (distToTop < avoidDist) {
      // Top wall - move down (90 degrees)
      newAngle = 90;
      needsAdjustment = true;
    } else if (distToBottom < avoidDist) {
      // Bottom wall - move up (270 degrees)
      newAngle = 270;
      needsAdjustment = true;
    }

    return needsAdjustment ? newAngle : null;
  }

  /**
   * Find and seek nearest food
   */
  private seekFood(
    bot: Player,
    allFoods: Map<string, Food>,
    headX: number,
    headY: number,
  ): number | null {
    let nearestFood: Food | null = null;
    let nearestDistance = this.config.foodSeekRange;

    allFoods.forEach((food) => {
      const dx = food.position.x - headX;
      const dy = food.position.y - headY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestFood = food;
      }
    });

    if (!nearestFood) {
      this.targetFoodId = null;
      return null;
    }

    this.targetFoodId = nearestFood.id;

    // Calculate angle to food
    const dx = nearestFood.position.x - headX;
    const dy = nearestFood.position.y - headY;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    angle = (angle + 360) % 360; // Normalize to [0, 360)

    return angle;
  }

  /**
   * Check if bot should use boost
   */
  shouldBoost(
    bot: Player,
    allPlayers: Map<string, Player>,
  ): boolean {
    // Only boost when fleeing from a player
    if (this.fleeTarget) {
      const headX = bot.headPosition.x;
      const headY = bot.headPosition.y;

      // Check if any player is very close
      let isInDanger = false;
      allPlayers.forEach((player, playerId) => {
        if (playerId === bot.id || !player.alive) {
          return;
        }

        const dx = player.headPosition.x - headX;
        const dy = player.headPosition.y - headY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Boost if player is close and bigger
        if (
          distance < this.config.minPlayerDistance &&
          player.segments.length >= bot.segments.length
        ) {
          isInDanger = true;
        }
      });

      return isInDanger && bot.score >= 1;
    }

    return false;
  }
}

