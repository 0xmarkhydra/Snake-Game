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
  private decisionInterval: number = 16; // Make decision every 16ms (60fps - extremely fast reaction - like top pro player)
  private lastAngle: number = 0;
  private skillLevel: number = 0.95; // Skill level 0-1 (95-99% perfect - extremely skilled)
  private lastFoodTarget: { x: number; y: number } | null = null;
  private isFleeing: boolean = false; // Track if bot is currently fleeing
  private safeZoneDistance: number = 800; // Distance needed to consider area "safe"
  private attackTargetId: string | null = null; // Track current attack target
  private lastBoostDecision: number = 0;
  private boostDecisionInterval: number = 50; // Boost decision every 50ms

  constructor(config?: Partial<BotConfig>) {
    this.config = {
      detectionRange: config?.detectionRange ?? 600, // Very good detection
      foodSeekRange: config?.foodSeekRange ?? 1000, // Look far for food
      wallAvoidanceDistance: config?.wallAvoidanceDistance ?? 500, // Much earlier wall avoidance (increased from 300)
      minPlayerDistance: config?.minPlayerDistance ?? 350, // Safe distance
      ...config,
    };

    // Add slight randomness to skill level (95-99% perfect - extremely skilled)
    this.skillLevel = 0.95 + Math.random() * 0.04;
  }

  /**
   * Calculate the angle the bot should move towards
   * Bot plays like a pro player - very good but not perfect
   * Priority: Survival > Attack > Food
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

    // PRIORITY 0: CRITICAL - Avoid player directly in front (immediate collision risk)
    // Check if any player is too close in front of bot's head
    const frontCollisionAvoidance = this.avoidFrontCollision(
      bot,
      allPlayers,
      headX,
      headY,
      worldWidth,
      worldHeight,
    );
    if (frontCollisionAvoidance !== null) {
      this.lastAngle = frontCollisionAvoidance;
      return frontCollisionAvoidance; // Immediate avoidance - no error (survival critical)
    }

    // PRIORITY 1: CRITICAL - Avoid walls (check first, highest priority for survival)
    // Use predictive wall checking based on current speed
    const wallAvoidanceAngle = this.avoidWallsPredictive(
      bot,
      headX,
      headY,
      worldWidth,
      worldHeight,
      bot.angle,
    );
    if (wallAvoidanceAngle !== null) {
      this.lastAngle = wallAvoidanceAngle;
      return wallAvoidanceAngle; // No error when avoiding walls (safety first - survival is key)
    }

    // PRIORITY 2: Check for dangerous players (bigger or same size) and flee
    // Bot will continue fleeing until it finds a safe zone
    const dangerousPlayer = this.findDangerousPlayer(
      bot,
      allPlayers,
      headX,
      headY,
    );

    // Check if we're in a safe zone (no dangerous players nearby)
    const isInSafeZone = this.isInSafeZone(bot, allPlayers, headX, headY);

    if (dangerousPlayer) {
      // Start or continue fleeing
      this.isFleeing = true;
      const fleeAngle = this.calculateSmartFleeAngle(
        bot,
        dangerousPlayer,
        headX,
        headY,
        worldWidth,
        worldHeight,
        allPlayers,
      );
      // Verify flee angle is safe (won't hit wall)
      if (this.isAngleSafe(bot, fleeAngle, worldWidth, worldHeight)) {
        this.fleeTarget = {
          x: dangerousPlayer.headPosition.x,
          y: dangerousPlayer.headPosition.y,
        };
        this.lastAngle = fleeAngle;
        // Add slight randomness to make it look more human (not perfect)
        return this.addHumanLikeError(fleeAngle, 1.5); // Less error when fleeing (survival priority)
      }
    } else if (this.isFleeing) {
      // No dangerous player detected, but we were fleeing
      // Continue fleeing until we reach a safe zone
      if (!isInSafeZone) {
        // Still not safe, continue fleeing in current direction or find safe direction
        if (this.fleeTarget) {
          // Continue fleeing away from last known danger position
          const dx = headX - this.fleeTarget.x;
          const dy = headY - this.fleeTarget.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0) {
            let continueFleeAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
            continueFleeAngle = (continueFleeAngle + 360) % 360;

            // Verify angle is safe
            if (
              this.isAngleSafe(bot, continueFleeAngle, worldWidth, worldHeight)
            ) {
              this.lastAngle = continueFleeAngle;
              return this.addHumanLikeError(continueFleeAngle, 1.5);
            }
          }
        }

        // Find direction to safest area (away from all players)
        const safeFleeAngle = this.findSafestDirection(
          bot,
          allPlayers,
          headX,
          headY,
          worldWidth,
          worldHeight,
        );
        if (safeFleeAngle !== null) {
          this.lastAngle = safeFleeAngle;
          return safeFleeAngle;
        }
      } else {
        // We've reached a safe zone, stop fleeing
        this.isFleeing = false;
        this.fleeTarget = null;
      }
    } else {
      // Not fleeing and no danger
      this.fleeTarget = null;
    }

    // PRIORITY 3: Check if we can attack smaller players (aggressive play)
    // Only attack if we're not fleeing (safety first)
    if (!this.isFleeing) {
      // Check if we should continue attacking current target or find new one
      let attackTarget = null;

      if (this.attackTargetId) {
        const currentTarget = allPlayers.get(this.attackTargetId);
        if (
          currentTarget &&
          currentTarget.alive &&
          currentTarget.segments.length < bot.segments.length
        ) {
          // Continue attacking current target if still valid
          attackTarget = currentTarget;
        } else {
          // Current target is invalid, find new one
          this.attackTargetId = null;
        }
      }

      // Find new target if we don't have one
      if (!attackTarget) {
        attackTarget = this.findAttackTarget(bot, allPlayers, headX, headY);
        if (attackTarget) {
          this.attackTargetId = attackTarget.id;
        }
      }

      if (attackTarget) {
        const attackAngle = this.calculateAttackAngle(
          bot,
          attackTarget,
          headX,
          headY,
          allPlayers,
          worldWidth,
          worldHeight,
        );
        if (
          attackAngle !== null &&
          this.isAngleSafe(bot, attackAngle, worldWidth, worldHeight)
        ) {
          this.lastAngle = attackAngle;
          // Less error when attacking (more precise)
          return this.addHumanLikeError(attackAngle, 1);
        }
      } else {
        this.attackTargetId = null;
      }
    }

    // PRIORITY 4: Seek best food (smart food selection)
    // Only seek food if we're not fleeing (survival first)
    if (!this.isFleeing) {
      const foodAngle = this.seekBestFood(
        bot,
        allFoods,
        headX,
        headY,
        allPlayers,
        worldWidth,
        worldHeight,
      );
      if (
        foodAngle !== null &&
        this.isAngleSafe(bot, foodAngle, worldWidth, worldHeight)
      ) {
        this.lastAngle = foodAngle;
        // Add slight randomness to make movement look more natural
        return this.addHumanLikeError(foodAngle, 1.5);
      }
    }

    // Default: Continue in current direction, but ensure it's safe
    if (this.isAngleSafe(bot, bot.angle, worldWidth, worldHeight)) {
      return this.addHumanLikeError(bot.angle, 1);
    }

    // If current angle is unsafe, find a safe angle
    const safeAngle = this.findSafeAngle(
      bot,
      headX,
      headY,
      worldWidth,
      worldHeight,
    );
    this.lastAngle = safeAngle;
    return safeAngle;
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

      // Check if would hit wall (use isAngleSafe for consistency)
      if (!this.isAngleSafe(bot, testAngle, worldWidth, worldHeight)) {
        return; // Skip this angle
      }

      // Check distance from dangerous player at future position
      const futureDx = futureX - dangerousPlayer.headPosition.x;
      const futureDy = futureY - dangerousPlayer.headPosition.y;
      const futureDistance = Math.sqrt(
        futureDx * futureDx + futureDy * futureDy,
      );

      // Check if other dangerous players are in the way
      let hasOtherDanger = false;
      allPlayers.forEach((player, playerId) => {
        if (
          playerId === bot.id ||
          playerId === dangerousPlayer.id ||
          !player.alive
        ) {
          return;
        }

        if (player.segments.length >= bot.segments.length) {
          const playerDx = futureX - player.headPosition.x;
          const playerDy = futureY - player.headPosition.y;
          const playerDistance = Math.sqrt(
            playerDx * playerDx + playerDy * playerDy,
          );

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
   * Improved: Better prediction, safer paths, wall avoidance
   */
  private calculateAttackAngle(
    bot: Player,
    target: Player,
    botX: number,
    botY: number,
    allPlayers: Map<string, Player>,
    worldWidth: number,
    worldHeight: number,
  ): number | null {
    // Better prediction: account for target's speed and boost
    const targetAngle = target.angle;
    const targetBaseSpeed = target.speed || 5;
    const targetNormalMultiplier = target.score < 10 ? 0.75 : 1.5;
    const targetSpeedMultiplier = target.boosting ? 5 : targetNormalMultiplier;
    const targetSpeed = targetBaseSpeed * targetSpeedMultiplier;

    // Predict further ahead for better interception (pro players think ahead)
    const predictionTime = 0.5; // Predict 0.5 seconds ahead
    const predictionDistance = targetSpeed * predictionTime * 60; // Convert to pixels

    const predictedX =
      target.headPosition.x +
      Math.cos((targetAngle * Math.PI) / 180) * predictionDistance;
    const predictedY =
      target.headPosition.y +
      Math.sin((targetAngle * Math.PI) / 180) * predictionDistance;

    // Try multiple intercept angles (pro players find best cut-off point)
    // More angles for better coverage
    const baseInterceptAngle =
      (Math.atan2(predictedY - botY, predictedX - botX) * 180) / Math.PI;
    const interceptAngles = [
      baseInterceptAngle, // Direct intercept
      (baseInterceptAngle + 20) % 360, // Slightly ahead
      (baseInterceptAngle - 20 + 360) % 360, // Slightly behind
      (baseInterceptAngle + 45) % 360, // More ahead
      (baseInterceptAngle - 45 + 360) % 360, // More behind
    ];

    let bestAngle: number | null = null;
    let bestScore = -Infinity;
    const botSpeed = this.getBotSpeed(bot);

    interceptAngles.forEach((testAngle) => {
      const normalizedAngle = (testAngle + 360) % 360;

      // Check if this angle is safe (won't hit wall)
      if (!this.isAngleSafe(bot, normalizedAngle, worldWidth, worldHeight)) {
        return; // Skip unsafe angles
      }

      // Calculate future position based on bot's speed
      const botFutureDistance = botSpeed * predictionTime * 60;
      const dx =
        Math.cos((normalizedAngle * Math.PI) / 180) * botFutureDistance;
      const dy =
        Math.sin((normalizedAngle * Math.PI) / 180) * botFutureDistance;
      const futureX = botX + dx;
      const futureY = botY + dy;

      // Calculate distance to predicted target position
      const targetDx = futureX - predictedX;
      const targetDy = futureY - predictedY;
      const targetDistance = Math.sqrt(
        targetDx * targetDx + targetDy * targetDy,
      );

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
          const playerDistance = Math.sqrt(
            playerDx * playerDx + playerDy * playerDy,
          );

          if (playerDistance < 300) {
            isSafe = false;
          }
          minDangerDistance = Math.min(minDangerDistance, playerDistance);
        }
      });

      // Score: closer to target = better, safe = bonus, far from danger = bonus
      // Higher score for better size advantage
      const sizeAdvantage = bot.segments.length - target.segments.length;
      if (isSafe && targetDistance < 500) {
        const distanceScore = (500 - targetDistance) * 2; // Closer = much better
        const safetyScore = minDangerDistance / 5; // Farther from danger = better
        const sizeScore = sizeAdvantage * 50; // Bigger advantage = better
        const score = distanceScore + safetyScore + sizeScore;

        if (score > bestScore) {
          bestScore = score;
          bestAngle = normalizedAngle;
        }
      }
    });

    return bestAngle;
  }

  /**
   * Avoid collision with player directly in front of bot
   * This is CRITICAL - highest priority to prevent immediate death
   */
  private avoidFrontCollision(
    bot: Player,
    allPlayers: Map<string, Player>,
    headX: number,
    headY: number,
    worldWidth: number,
    worldHeight: number,
  ): number | null {
    const botSpeed = this.getBotSpeed(bot);
    const botAngleRad = (bot.angle * Math.PI) / 180;

    // Look ahead distance based on speed (predict where bot will be)
    const lookAheadDistance = botSpeed * 3; // Look 3 frames ahead
    const criticalDistance = 150; // Critical distance - must avoid if player within this

    // Calculate future position in current direction
    const futureX = headX + Math.cos(botAngleRad) * lookAheadDistance;
    const futureY = headY + Math.sin(botAngleRad) * lookAheadDistance;

    // Check all players for collision risk
    let closestPlayerInFront: {
      player: Player;
      distance: number;
      angle: number;
    } | null = null;
    let minDistance = Infinity;

    allPlayers.forEach((player, playerId) => {
      if (playerId === bot.id || !player.alive) {
        return;
      }

      // Check player head position
      const playerHeadX = player.headPosition.x;
      const playerHeadY = player.headPosition.y;

      // Calculate vector from bot to player
      const dx = playerHeadX - headX;
      const dy = playerHeadY - headY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if player is in front of bot (within 90 degree cone)
      const angleToPlayer = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalizedAngleToPlayer = (angleToPlayer + 360) % 360;
      const normalizedBotAngle = (bot.angle + 360) % 360;

      // Calculate angle difference
      let angleDiff = Math.abs(normalizedAngleToPlayer - normalizedBotAngle);
      if (angleDiff > 180) {
        angleDiff = 360 - angleDiff;
      }

      // Player is in front if within 90 degrees of bot's direction
      const isInFront = angleDiff <= 90;

      if (isInFront && distance < criticalDistance && distance < minDistance) {
        minDistance = distance;
        closestPlayerInFront = {
          player,
          distance,
          angle: normalizedAngleToPlayer,
        };
      }

      // Also check player body segments (more dangerous)
      for (let i = 1; i < Math.min(player.segments.length, 10); i++) {
        const segment = player.segments[i];
        if (segment && segment.position) {
          const segDx = segment.position.x - headX;
          const segDy = segment.position.y - headY;
          const segDistance = Math.sqrt(segDx * segDx + segDy * segDy);

          // Check if segment is in front
          const segAngle = (Math.atan2(segDy, segDx) * 180) / Math.PI;
          const normalizedSegAngle = (segAngle + 360) % 360;
          let segAngleDiff = Math.abs(normalizedSegAngle - normalizedBotAngle);
          if (segAngleDiff > 180) {
            segAngleDiff = 360 - segAngleDiff;
          }

          const isSegInFront = segAngleDiff <= 90;

          if (
            isSegInFront &&
            segDistance < criticalDistance &&
            segDistance < minDistance
          ) {
            minDistance = segDistance;
            closestPlayerInFront = {
              player,
              distance: segDistance,
              angle: normalizedSegAngle,
            };
          }
        }
      }
    });

    // If player is too close in front, calculate avoidance angle
    if (closestPlayerInFront && minDistance < criticalDistance) {
      // Calculate angle away from player
      const avoidAngle = (closestPlayerInFront.angle + 180) % 360;

      // Try multiple avoidance angles (left, right, perpendicular)
      const testAngles = [
        avoidAngle, // Direct away
        (avoidAngle + 45) % 360, // 45 degrees right
        (avoidAngle - 45 + 360) % 360, // 45 degrees left
        (avoidAngle + 90) % 360, // Perpendicular right
        (avoidAngle - 90 + 360) % 360, // Perpendicular left
      ];

      // Find best avoidance angle (safe and away from player)
      for (const testAngle of testAngles) {
        if (this.isAngleSafe(bot, testAngle, worldWidth, worldHeight)) {
          // Verify this angle moves away from player
          const testAngleRad = (testAngle * Math.PI) / 180;
          const testFutureX =
            headX + Math.cos(testAngleRad) * lookAheadDistance;
          const testFutureY =
            headY + Math.sin(testAngleRad) * lookAheadDistance;

          const futureDx =
            testFutureX - closestPlayerInFront.player.headPosition.x;
          const futureDy =
            testFutureY - closestPlayerInFront.player.headPosition.y;
          const futureDistance = Math.sqrt(
            futureDx * futureDx + futureDy * futureDy,
          );

          // If future position is farther from player, this is a good angle
          if (futureDistance > minDistance) {
            return testAngle;
          }
        }
      }

      // If no perfect angle found, use safest angle
      return this.findSafeAngle(bot, headX, headY, worldWidth, worldHeight);
    }

    return null; // No immediate collision risk
  }

  /**
   * Calculate bot's current speed (accounting for boost and score)
   */
  private getBotSpeed(bot: Player): number {
    const baseSpeed = bot.speed || 5;
    // Calculate speed multiplier based on boost and score (same as game logic)
    const normalMultiplier = bot.score < 10 ? 0.75 : 1.5;
    const boostMultiplier = bot.boosting ? 5 : 1;
    const speedMultiplier = bot.boosting ? boostMultiplier : normalMultiplier;

    // Account for turn penalty (if turning)
    const isTurning = Math.abs(bot.currentTurnRate) > 1;
    const turnPenalty = isTurning ? 0.7 : 1;

    return baseSpeed * speedMultiplier * turnPenalty;
  }

  /**
   * Predictive wall avoidance - checks future position based on current speed
   * This prevents bot from hitting walls even when moving fast
   */
  private avoidWallsPredictive(
    bot: Player,
    headX: number,
    headY: number,
    worldWidth: number,
    worldHeight: number,
    currentAngle: number,
  ): number | null {
    const avoidDist = this.config.wallAvoidanceDistance;
    const botSpeed = this.getBotSpeed(bot);

    // Predict position after multiple frames (look ahead further for faster speeds)
    const lookAheadFrames = Math.ceil(botSpeed / 2); // More frames for faster speed
    const predictionDistance = botSpeed * lookAheadFrames * 2; // Predict 2x further

    const angleRad = (currentAngle * Math.PI) / 180;
    const futureX = headX + Math.cos(angleRad) * predictionDistance;
    const futureY = headY + Math.sin(angleRad) * predictionDistance;

    // Check if future position would hit wall
    const distToLeft = futureX;
    const distToRight = worldWidth - futureX;
    const distToTop = futureY;
    const distToBottom = worldHeight - futureY;

    // Also check current position (immediate danger)
    const currentDistToLeft = headX;
    const currentDistToRight = worldWidth - headX;
    const currentDistToTop = headY;
    const currentDistToBottom = worldHeight - headY;

    // Use the minimum distance (current or future) for safety
    const minDistToLeft = Math.min(distToLeft, currentDistToLeft);
    const minDistToRight = Math.min(distToRight, currentDistToRight);
    const minDistToTop = Math.min(distToTop, currentDistToTop);
    const minDistToBottom = Math.min(distToBottom, currentDistToBottom);

    // Find the closest wall
    const minDistance = Math.min(
      minDistToLeft,
      minDistToRight,
      minDistToTop,
      minDistToBottom,
    );

    // If any wall is too close, calculate safe escape angle
    if (minDistance < avoidDist) {
      // Calculate best escape angle (away from closest wall)
      let escapeAngle: number;

      // Check corners first (most dangerous)
      if (minDistToLeft < avoidDist * 0.7 && minDistToTop < avoidDist * 0.7) {
        // Top-left corner - move down-right (45 degrees)
        escapeAngle = 45;
      } else if (
        minDistToRight < avoidDist * 0.7 &&
        minDistToTop < avoidDist * 0.7
      ) {
        // Top-right corner - move down-left (135 degrees)
        escapeAngle = 135;
      } else if (
        minDistToLeft < avoidDist * 0.7 &&
        minDistToBottom < avoidDist * 0.7
      ) {
        // Bottom-left corner - move up-right (315 degrees)
        escapeAngle = 315;
      } else if (
        minDistToRight < avoidDist * 0.7 &&
        minDistToBottom < avoidDist * 0.7
      ) {
        // Bottom-right corner - move up-left (225 degrees)
        escapeAngle = 225;
      }
      // Check individual walls
      else if (minDistToLeft < avoidDist) {
        // Left wall - move right (0 degrees, but allow slight variation)
        escapeAngle = 0;
      } else if (minDistToRight < avoidDist) {
        // Right wall - move left (180 degrees)
        escapeAngle = 180;
      } else if (minDistToTop < avoidDist) {
        // Top wall - move down (90 degrees)
        escapeAngle = 90;
      } else if (minDistToBottom < avoidDist) {
        // Bottom wall - move up (270 degrees)
        escapeAngle = 270;
      } else {
        return null; // No immediate danger
      }

      // Verify escape angle is safe
      const escapeAngleRad = (escapeAngle * Math.PI) / 180;
      const escapeFutureX =
        headX + Math.cos(escapeAngleRad) * predictionDistance;
      const escapeFutureY =
        headY + Math.sin(escapeAngleRad) * predictionDistance;

      // Double-check escape path is safe
      if (
        escapeFutureX > avoidDist &&
        escapeFutureX < worldWidth - avoidDist &&
        escapeFutureY > avoidDist &&
        escapeFutureY < worldHeight - avoidDist
      ) {
        return escapeAngle;
      }

      // If escape angle is not safe, find best safe angle
      return this.findSafeAngle(bot, headX, headY, worldWidth, worldHeight);
    }

    return null; // No wall danger detected
  }

  /**
   * Check if an angle is safe (won't hit wall in near future)
   */
  private isAngleSafe(
    bot: Player,
    angle: number,
    worldWidth: number,
    worldHeight: number,
  ): boolean {
    const headX = bot.headPosition.x;
    const headY = bot.headPosition.y;
    const botSpeed = this.getBotSpeed(bot);
    const lookAheadFrames = Math.ceil(botSpeed / 2);
    const predictionDistance = botSpeed * lookAheadFrames * 2;

    const angleRad = (angle * Math.PI) / 180;
    const futureX = headX + Math.cos(angleRad) * predictionDistance;
    const futureY = headY + Math.sin(angleRad) * predictionDistance;

    const safeBuffer = this.config.wallAvoidanceDistance * 0.8; // 80% of avoidance distance

    return (
      futureX > safeBuffer &&
      futureX < worldWidth - safeBuffer &&
      futureY > safeBuffer &&
      futureY < worldHeight - safeBuffer
    );
  }

  /**
   * Check if bot is in a safe zone (no dangerous players nearby)
   */
  private isInSafeZone(
    bot: Player,
    allPlayers: Map<string, Player>,
    headX: number,
    headY: number,
  ): boolean {
    let hasDangerNearby = false;

    allPlayers.forEach((player, playerId) => {
      if (playerId === bot.id || !player.alive) {
        return;
      }

      // Check if player is bigger or same size (dangerous)
      if (player.segments.length >= bot.segments.length) {
        const dx = player.headPosition.x - headX;
        const dy = player.headPosition.y - headY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If any dangerous player is within safe zone distance, we're not safe
        if (distance < this.safeZoneDistance) {
          hasDangerNearby = true;
        }
      }
    });

    return !hasDangerNearby;
  }

  /**
   * Find the safest direction to move (away from all dangerous players)
   */
  private findSafestDirection(
    bot: Player,
    allPlayers: Map<string, Player>,
    headX: number,
    headY: number,
    worldWidth: number,
    worldHeight: number,
  ): number | null {
    // Collect all dangerous players
    const dangerousPlayers: Array<{ x: number; y: number; size: number }> = [];

    allPlayers.forEach((player, playerId) => {
      if (playerId === bot.id || !player.alive) {
        return;
      }

      if (player.segments.length >= bot.segments.length) {
        dangerousPlayers.push({
          x: player.headPosition.x,
          y: player.headPosition.y,
          size: player.segments.length,
        });
      }
    });

    if (dangerousPlayers.length === 0) {
      return null; // No danger, no need to flee
    }

    // Calculate weighted average direction away from all dangerous players
    let totalDx = 0;
    let totalDy = 0;
    let totalWeight = 0;

    dangerousPlayers.forEach((danger) => {
      const dx = headX - danger.x;
      const dy = headY - danger.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        // Weight by size difference and inverse distance (closer and bigger = more weight)
        const sizeDiff = danger.size - bot.segments.length;
        const weight = (sizeDiff + 1) / (distance + 1); // Bigger size diff and closer = heavier weight

        totalDx += (dx / distance) * weight;
        totalDy += (dy / distance) * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) {
      return null;
    }

    // Normalize direction
    const avgDx = totalDx / totalWeight;
    const avgDy = totalDy / totalWeight;
    const avgDistance = Math.sqrt(avgDx * avgDx + avgDy * avgDy);

    if (avgDistance === 0) {
      return null;
    }

    let safestAngle = (Math.atan2(avgDy, avgDx) * 180) / Math.PI;
    safestAngle = (safestAngle + 360) % 360;

    // Verify this angle is safe (won't hit wall)
    if (this.isAngleSafe(bot, safestAngle, worldWidth, worldHeight)) {
      return safestAngle;
    }

    // If not safe, try perpendicular directions
    const testAngles = [
      (safestAngle + 90) % 360,
      (safestAngle - 90 + 360) % 360,
      (safestAngle + 45) % 360,
      (safestAngle - 45 + 360) % 360,
    ];

    for (const testAngle of testAngles) {
      if (this.isAngleSafe(bot, testAngle, worldWidth, worldHeight)) {
        return testAngle;
      }
    }

    // Last resort: find any safe angle
    return this.findSafeAngle(bot, headX, headY, worldWidth, worldHeight);
  }

  /**
   * Find a safe angle to move (away from walls)
   */
  private findSafeAngle(
    bot: Player,
    headX: number,
    headY: number,
    worldWidth: number,
    worldHeight: number,
  ): number {
    const avoidDist = this.config.wallAvoidanceDistance;

    // Calculate distances to walls
    const distToLeft = headX;
    const distToRight = worldWidth - headX;
    const distToTop = headY;
    const distToBottom = worldHeight - headY;

    // Find direction with most space (safest direction)
    const maxDist = Math.max(distToLeft, distToRight, distToTop, distToBottom);

    // Move towards the direction with most space
    if (maxDist === distToRight) {
      return 0; // Move right
    } else if (maxDist === distToLeft) {
      return 180; // Move left
    } else if (maxDist === distToTop) {
      return 270; // Move up
    } else {
      return 90; // Move down
    }
  }

  /**
   * Avoid walls by adjusting angle (legacy method, kept for compatibility)
   */
  private avoidWalls(
    headX: number,
    headY: number,
    worldWidth: number,
    worldHeight: number,
    currentAngle: number,
  ): number | null {
    // Use predictive method instead
    return null;
  }

  /**
   * Find and seek best food (prioritize high value and safe food)
   * Pro players optimize food selection
   * Improved: Wall safety check, better food selection
   * Bot can see full map to find food
   */
  private seekBestFood(
    bot: Player,
    allFoods: Map<string, Food>,
    headX: number,
    headY: number,
    allPlayers: Map<string, Player>,
    worldWidth: number,
    worldHeight: number,
  ): number | null {
    let bestFood: Food | null = null;
    let bestScore = -Infinity;

    // Bot can see full map - check all foods (no distance limit)
    allFoods.forEach((food) => {
      const dx = food.position.x - headX;
      const dy = food.position.y - headY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // No distance limit - bot can see full map
      // But closer food still gets higher score (distance penalty in scoring)

      // Calculate score: higher value food and closer = better
      // Top pro players prioritize value/distance ratio with smart weighting
      // Distance penalty: farther food = lower score (but still considered)
      const distancePenalty = 1 / (1 + distance / 1000); // Normalize distance penalty

      // Value multiplier increases with bot size (bigger bot = more value needed)
      const valueMultiplier = 200 + bot.segments.length * 5; // Scale with size
      let score = food.value * valueMultiplier * distancePenalty; // Value * distance penalty

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
          const playerDistance = Math.sqrt(
            playerDx * playerDx + playerDy * playerDy,
          );

          // Penalize food near dangerous players (more penalty if closer)
          if (playerDistance < 400) {
            const dangerFactor = 1 - playerDistance / 400;
            score *= 1 - dangerFactor * 0.7; // Up to 70% penalty
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
      const angleToFood = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalizedAngle = (angleToFood + 360) % 360;

      // Check if path to food is safe (won't hit wall)
      if (!this.isAngleSafe(bot, normalizedAngle, worldWidth, worldHeight)) {
        score *= 0.3; // Heavy penalty for unsafe food (but don't completely ignore)
      }

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
   * Improved: Smarter boost usage for maximum efficiency
   */
  shouldBoost(
    bot: Player,
    allPlayers: Map<string, Player>,
    currentTime?: number,
  ): boolean {
    if (bot.score < 1) {
      return false; // Need score to boost
    }

    // Throttle boost decisions for performance
    if (
      currentTime &&
      currentTime - this.lastBoostDecision < this.boostDecisionInterval
    ) {
      return bot.boosting; // Keep current boost state
    }
    if (currentTime) {
      this.lastBoostDecision = currentTime;
    }

    const headX = bot.headPosition.x;
    const headY = bot.headPosition.y;

    // PRIORITY 1: Boost when fleeing from dangerous player (survival)
    if (this.fleeTarget || this.isFleeing) {
      let isInDanger = false;
      let closestDangerDistance = Infinity;

      allPlayers.forEach((player, playerId) => {
        if (playerId === bot.id || !player.alive) {
          return;
        }

        if (player.segments.length >= bot.segments.length) {
          const dx = player.headPosition.x - headX;
          const dy = player.headPosition.y - headY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          closestDangerDistance = Math.min(closestDangerDistance, distance);

          // Boost if dangerous player is close (within danger zone)
          if (distance < this.config.minPlayerDistance * 1.5) {
            isInDanger = true;
          }
        }
      });

      // Boost if in immediate danger or getting closer to danger
      if (isInDanger || closestDangerDistance < 500) {
        return true;
      }
    }

    // PRIORITY 2: Boost when attacking smaller player (aggressive play)
    if (this.attackTargetId && !this.isFleeing) {
      const target = allPlayers.get(this.attackTargetId);
      if (
        target &&
        target.alive &&
        target.segments.length < bot.segments.length
      ) {
        const dx = target.headPosition.x - headX;
        const dy = target.headPosition.y - headY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Boost to catch smaller player if in optimal range
        // Use boost when close enough to catch but not too close (avoid overshooting)
        if (distance < 500 && distance > 100) {
          // Also check if we're closing in (getting closer)
          const targetSpeed = target.boosting
            ? 25
            : target.score < 10
              ? 3.75
              : 7.5;
          const botSpeed = this.getBotSpeed(bot);

          // Calculate if we can catch up
          const relativeSpeed = botSpeed - targetSpeed;
          if (relativeSpeed > 0 || distance < 300) {
            return true;
          }
        }
      }
    }

    // PRIORITY 3: Boost when going for high-value food (if safe)
    if (!this.isFleeing && this.targetFoodId) {
      // Check if we're going for valuable food and it's safe
      // (This would require food data, but we can skip for now to keep it simple)
    }

    return false;
  }
}
