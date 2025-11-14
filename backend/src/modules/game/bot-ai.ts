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
  private decisionInterval: number = 30; // Make decision every 30ms (very fast reaction - like pro player)
  private lastAngle: number = 0;
  private skillLevel: number = 0.85; // Skill level 0-1 (0.85 = very good but not perfect)
  private lastFoodTarget: { x: number; y: number } | null = null;

  constructor(config?: Partial<BotConfig>) {
    this.config = {
      detectionRange: config?.detectionRange ?? 600, // Very good detection
      foodSeekRange: config?.foodSeekRange ?? 1000, // Look far for food
      wallAvoidanceDistance: config?.wallAvoidanceDistance ?? 300, // Early wall avoidance
      minPlayerDistance: config?.minPlayerDistance ?? 350, // Safe distance
      ...config,
    };
    
    // Add slight randomness to skill level (85-95% perfect)
    this.skillLevel = 0.85 + Math.random() * 0.1;
  }

  /**
   * Calculate the angle the bot should move towards
   * Bot plays like a pro player - very good but not perfect
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

    // Priority 1: Check for dangerous players (bigger or same size) and flee
    const dangerousPlayer = this.findDangerousPlayer(
      bot,
      allPlayers,
      headX,
      headY,
    );
    if (dangerousPlayer) {
      const fleeAngle = this.calculateSmartFleeAngle(
        bot,
        dangerousPlayer,
        headX,
        headY,
        worldWidth,
        worldHeight,
        allPlayers,
      );
      this.fleeTarget = { x: dangerousPlayer.headPosition.x, y: dangerousPlayer.headPosition.y };
      this.lastAngle = fleeAngle;
      // Add slight randomness to make it look more human (not perfect)
      return this.addHumanLikeError(fleeAngle, 3);
    }
    this.fleeTarget = null;

    // Priority 2: Check if we can attack smaller players (aggressive play)
    const attackTarget = this.findAttackTarget(bot, allPlayers, headX, headY);
    if (attackTarget) {
      const attackAngle = this.calculateAttackAngle(
        bot,
        attackTarget,
        headX,
        headY,
        allPlayers,
      );
      if (attackAngle !== null) {
        this.lastAngle = attackAngle;
        // Add slight randomness for human-like imperfection
        return this.addHumanLikeError(attackAngle, 2);
      }
    }

    // Priority 3: Avoid walls (earlier detection)
    const wallAvoidanceAngle = this.avoidWalls(
      headX,
      headY,
      worldWidth,
      worldHeight,
      bot.angle,
    );
    if (wallAvoidanceAngle !== null) {
      this.lastAngle = wallAvoidanceAngle;
      return wallAvoidanceAngle; // No error when avoiding walls (safety first)
    }

    // Priority 4: Seek best food (smart food selection)
    const foodAngle = this.seekBestFood(bot, allFoods, headX, headY, allPlayers);
    if (foodAngle !== null) {
      this.lastAngle = foodAngle;
      // Add slight randomness to make movement look more natural
      return this.addHumanLikeError(foodAngle, 2);
    }

    // Default: Continue in current direction with slight variation
    return this.addHumanLikeError(bot.angle, 1);
  }

  /**
   * Add human-like error to angle (makes bot look more natural, not perfect)
   */
  private addHumanLikeError(angle: number, maxError: number): number {
    // Apply skill level - better skill = less error
    const error = (1 - this.skillLevel) * maxError;
    const randomError = (Math.random() - 0.5) * 2 * error; // -error to +error
    
    let newAngle = angle + randomError;
    
    // Normalize to [0, 360)
    while (newAngle < 0) newAngle += 360;
    while (newAngle >= 360) newAngle -= 360;
    
    return newAngle;
  }

  /**
   * Find dangerous player (bigger or same size) within detection range
   * Pro players detect threats early
   */
  private findDangerousPlayer(
    bot: Player,
    allPlayers: Map<string, Player>,
    headX: number,
    headY: number,
  ): Player | null {
    let nearestPlayer: Player | null = null;
    let nearestDistance = this.config.detectionRange;
    let mostDangerous: Player | null = null;
    let mostDangerousDistance = Infinity;

    allPlayers.forEach((player, playerId) => {
      if (playerId === bot.id || !player.alive) {
        return;
      }

      // Check if player is bigger or same size (dangerous)
      const isPlayerBigger = player.segments.length > bot.segments.length;
      const isPlayerSameSize = player.segments.length === bot.segments.length;
      const sizeDifference = player.segments.length - bot.segments.length;

      // Only flee from bigger or same-size players
      if (!isPlayerBigger && !isPlayerSameSize) {
        return;
      }

      // Check distance to player head
      const dx = player.headPosition.x - headX;
      const dy = player.headPosition.y - headY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Also check if player body is close (more dangerous)
      let minBodyDistance = distance;
      for (let i = 1; i < Math.min(player.segments.length, 15); i++) {
        const segment = player.segments[i];
        if (segment && segment.position) {
          const bodyDx = segment.position.x - headX;
          const bodyDy = segment.position.y - headY;
          const bodyDistance = Math.sqrt(bodyDx * bodyDx + bodyDy * bodyDy);
          minBodyDistance = Math.min(minBodyDistance, bodyDistance);
        }
      }

      // Prioritize bigger and closer players (more dangerous)
      const dangerScore = sizeDifference * 100 - minBodyDistance;
      
      if (minBodyDistance < nearestDistance) {
        nearestDistance = minBodyDistance;
        nearestPlayer = player;
      }
      
      // Track most dangerous (biggest size advantage)
      if (dangerScore > 0 && minBodyDistance < mostDangerousDistance) {
        mostDangerous = player;
        mostDangerousDistance = minBodyDistance;
      }
    });

    // Return most dangerous if found, otherwise nearest
    return mostDangerous || nearestPlayer;
  }

  /**
   * Find smaller player to attack
   */
  private findAttackTarget(
    bot: Player,
    allPlayers: Map<string, Player>,
    headX: number,
    headY: number,
  ): Player | null {
    let bestTarget: Player | null = null;
    let bestScore = 0;

    allPlayers.forEach((player, playerId) => {
      if (playerId === bot.id || !player.alive) {
        return;
      }

      // Only attack smaller players
      if (player.segments.length >= bot.segments.length) {
        return;
      }

      const dx = player.headPosition.x - headX;
      const dy = player.headPosition.y - headY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Prefer closer and significantly smaller targets
      const sizeAdvantage = bot.segments.length - player.segments.length;
      const score = sizeAdvantage / (distance + 1); // Closer and bigger advantage = better

      if (score > bestScore && distance < this.config.foodSeekRange) {
        bestScore = score;
        bestTarget = player;
      }
    });

    return bestTarget;
  }

  /**
   * Calculate smart flee angle - avoid player and walls
   * Pro players find the best escape route
   */
  private calculateSmartFleeAngle(
    bot: Player,
    dangerousPlayer: Player,
    botX: number,
    botY: number,
    worldWidth: number,
    worldHeight: number,
    allPlayers: Map<string, Player>,
  ): number {
    // Calculate basic flee angle away from player
    const dx = botX - dangerousPlayer.headPosition.x;
    const dy = botY - dangerousPlayer.headPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return Math.random() * 360;
    }

    let baseAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    baseAngle = (baseAngle + 360) % 360;

    // Pro players check multiple escape routes
    const testAngles = [
      baseAngle, // Direct away
      (baseAngle + 45) % 360, // 45 degrees right
      (baseAngle - 45 + 360) % 360, // 45 degrees left
      (baseAngle + 90) % 360, // Perpendicular right
      (baseAngle - 90 + 360) % 360, // Perpendicular left
    ];

    let bestAngle = baseAngle;
    let bestScore = -Infinity;

    testAngles.forEach((testAngle) => {
      const futureX = botX + Math.cos((testAngle * Math.PI) / 180) * 200;
      const futureY = botY + Math.sin((testAngle * Math.PI) / 180) * 200;

      // Check if would hit wall
      const wallBuffer = 150;
      if (futureX < wallBuffer || futureX > worldWidth - wallBuffer || 
          futureY < wallBuffer || futureY > worldHeight - wallBuffer) {
        return; // Skip this angle
      }

      // Check distance from dangerous player at future position
      const futureDx = futureX - dangerousPlayer.headPosition.x;
      const futureDy = futureY - dangerousPlayer.headPosition.y;
      const futureDistance = Math.sqrt(futureDx * futureDx + futureDy * futureDy);

      // Check if other dangerous players are in the way
      let hasOtherDanger = false;
      allPlayers.forEach((player, playerId) => {
        if (playerId === bot.id || playerId === dangerousPlayer.id || !player.alive) {
          return;
        }

        if (player.segments.length >= bot.segments.length) {
          const playerDx = futureX - player.headPosition.x;
          const playerDy = futureY - player.headPosition.y;
          const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);

          if (playerDistance < 300) {
            hasOtherDanger = true;
          }
        }
      });

      // Score: farther from danger = better, no other danger = bonus
      const score = futureDistance - (hasOtherDanger ? 200 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestAngle = testAngle;
      }
    });

    return bestAngle;
  }

  /**
   * Calculate attack angle to cut off smaller player
   * Pro players predict movement and cut off escape routes
   */
  private calculateAttackAngle(
    bot: Player,
    target: Player,
    botX: number,
    botY: number,
    allPlayers: Map<string, Player>,
  ): number | null {
    // Predict where target is heading (better prediction for pro players)
    const targetAngle = target.angle;
    const targetSpeed = target.boosting ? 5 * 5 : 5 * 2.5; // Account for boost
    const predictionDistance = 300; // Predict further ahead (pro players think ahead)

    const predictedX = target.headPosition.x + Math.cos((targetAngle * Math.PI) / 180) * predictionDistance;
    const predictedY = target.headPosition.y + Math.sin((targetAngle * Math.PI) / 180) * predictionDistance;

    // Try multiple intercept angles (pro players find best cut-off point)
    const interceptAngles = [
      Math.atan2(predictedY - botY, predictedX - botX) * 180 / Math.PI, // Direct intercept
      Math.atan2(predictedY - botY, predictedX - botX) * 180 / Math.PI + 30, // Ahead of target
      Math.atan2(predictedY - botY, predictedX - botX) * 180 / Math.PI - 30, // Behind target
    ];

    let bestAngle: number | null = null;
    let bestScore = -Infinity;

    interceptAngles.forEach((testAngle) => {
      const normalizedAngle = (testAngle + 360) % 360;
      const dx = Math.cos((normalizedAngle * Math.PI) / 180) * 200;
      const dy = Math.sin((normalizedAngle * Math.PI) / 180) * 200;
      const futureX = botX + dx;
      const futureY = botY + dy;

      // Calculate distance to predicted target position
      const targetDx = futureX - predictedX;
      const targetDy = futureY - predictedY;
      const targetDistance = Math.sqrt(targetDx * targetDx + targetDy * targetDy);

      // Check if path is safe (no other dangerous players)
      let isSafe = true;
      let minDangerDistance = Infinity;
      
      allPlayers.forEach((player, playerId) => {
        if (playerId === bot.id || playerId === target.id || !player.alive) {
          return;
        }

        if (player.segments.length >= bot.segments.length) {
          const playerDx = player.headPosition.x - futureX;
          const playerDy = player.headPosition.y - futureY;
          const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);

          if (playerDistance < 250) {
            isSafe = false;
          }
          minDangerDistance = Math.min(minDangerDistance, playerDistance);
        }
      });

      // Score: closer to target = better, safe = bonus, far from danger = bonus
      if (isSafe && targetDistance < 400) {
        const score = (400 - targetDistance) + (minDangerDistance / 10);
        if (score > bestScore) {
          bestScore = score;
          bestAngle = normalizedAngle;
        }
      }
    });

    return bestAngle;
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
   * Find and seek best food (prioritize high value and safe food)
   * Pro players optimize food selection
   */
  private seekBestFood(
    bot: Player,
    allFoods: Map<string, Food>,
    headX: number,
    headY: number,
    allPlayers: Map<string, Player>,
  ): number | null {
    let bestFood: Food | null = null;
    let bestScore = -Infinity;

    allFoods.forEach((food) => {
      const dx = food.position.x - headX;
      const dy = food.position.y - headY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.config.foodSeekRange) {
        return;
      }

      // Calculate score: higher value food and closer = better
      // Pro players prioritize value/distance ratio
      let score = (food.value * 200) / (distance + 1); // Higher multiplier for value

      // Check if food is near dangerous players
      let isSafe = true;
      let dangerLevel = 0;
      allPlayers.forEach((player, playerId) => {
        if (playerId === bot.id || !player.alive) {
          return;
        }

        if (player.segments.length >= bot.segments.length) {
          const playerDx = player.headPosition.x - food.position.x;
          const playerDy = player.headPosition.y - food.position.y;
          const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);

          // Penalize food near dangerous players (more penalty if closer)
          if (playerDistance < 400) {
            const dangerFactor = 1 - (playerDistance / 400);
            score *= (1 - dangerFactor * 0.7); // Up to 70% penalty
            isSafe = false;
            dangerLevel = Math.max(dangerLevel, dangerFactor);
          }
        }
      });

      // Bonus for safe food
      if (isSafe) {
        score *= 2.0; // Bigger bonus for safe food
      }

      // Prefer food that's in a good direction (not towards walls)
      const angleToFood = Math.atan2(dy, dx) * 180 / Math.PI;
      const normalizedAngle = (angleToFood + 360) % 360;
      
      // Small bonus if food is in current direction (efficiency)
      const angleDiff = Math.abs(normalizedAngle - bot.angle);
      const minAngleDiff = Math.min(angleDiff, 360 - angleDiff);
      if (minAngleDiff < 30) {
        score *= 1.2; // 20% bonus for food in similar direction
      }

      if (score > bestScore) {
        bestScore = score;
        bestFood = food;
      }
    });

    if (!bestFood) {
      this.targetFoodId = null;
      this.lastFoodTarget = null;
      return null;
    }

    this.targetFoodId = bestFood.id;
    this.lastFoodTarget = { x: bestFood.position.x, y: bestFood.position.y };

    // Calculate angle to food
    const dx = bestFood.position.x - headX;
    const dy = bestFood.position.y - headY;
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
    if (bot.score < 1) {
      return false; // Need score to boost
    }

    const headX = bot.headPosition.x;
    const headY = bot.headPosition.y;

    // Boost when fleeing from dangerous player
    if (this.fleeTarget) {
      let isInDanger = false;
      allPlayers.forEach((player, playerId) => {
        if (playerId === bot.id || !player.alive) {
          return;
        }

        const dx = player.headPosition.x - headX;
        const dy = player.headPosition.y - headY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Boost if dangerous player is close
        if (
          distance < this.config.minPlayerDistance &&
          player.segments.length >= bot.segments.length
        ) {
          isInDanger = true;
        }
      });

      return isInDanger;
    }

    // Also boost when chasing smaller player (aggressive play)
    let shouldBoostForAttack = false;
    allPlayers.forEach((player, playerId) => {
      if (playerId === bot.id || !player.alive) {
        return;
      }

      if (player.segments.length < bot.segments.length) {
        const dx = player.headPosition.x - headX;
        const dy = player.headPosition.y - headY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Boost to catch smaller player if close enough
        if (distance < 400 && distance > 150) {
          shouldBoostForAttack = true;
        }
      }
    });

    return shouldBoostForAttack;
  }
}

