# Game Logic Updates - Snake Size & Tokenomics Integration

## 1. Snake Size Calculation

### 1.1 Formula Design

**Base Formula:**
```
snakeSize = baseSize + (stakeAmount * multiplier)
```

**Parameters:**
- `baseSize`: Minimum starting size (default: 5 segments)
- `multiplier`: Segments per SOL (default: 20)
- `stakeAmount`: Amount of SOL staked

**Examples:**
| Stake Amount | Snake Size | Calculation |
|--------------|------------|-------------|
| 0.1 SOL | 7 segments | 5 + (0.1 × 20) = 7 |
| 0.5 SOL | 15 segments | 5 + (0.5 × 20) = 15 |
| 1.0 SOL | 25 segments | 5 + (1.0 × 20) = 25 |
| 5.0 SOL | 105 segments | 5 + (5.0 × 20) = 105 |
| 10.0 SOL | 205 segments | 5 + (10.0 × 20) = 205 |

### 1.2 Alternative Formulas

**Logarithmic Growth (for better balance):**
```typescript
snakeSize = baseSize + Math.floor(Math.log(stakeAmount + 1) * scaleFactor)
```

**Square Root Growth:**
```typescript
snakeSize = baseSize + Math.floor(Math.sqrt(stakeAmount * 100) * multiplier)
```

**Tiered System:**
```typescript
function calculateSnakeSize(stakeAmount: number): number {
  if (stakeAmount <= 0.5) return 5 + Math.floor(stakeAmount * 20);
  if (stakeAmount <= 2.0) return 15 + Math.floor((stakeAmount - 0.5) * 15);
  if (stakeAmount <= 5.0) return 37 + Math.floor((stakeAmount - 2.0) * 10);
  return 67 + Math.floor((stakeAmount - 5.0) * 5);
}
```

### 1.3 Recommended Formula

**Hybrid Approach (balanced):**
```typescript
function calculateSnakeSize(stakeAmount: number): number {
  const baseSize = 5;
  const linearPart = Math.min(stakeAmount, 1.0) * 20; // Linear up to 1 SOL
  const diminishingPart = Math.max(0, stakeAmount - 1.0) * 10; // Half growth after 1 SOL
  return Math.floor(baseSize + linearPart + diminishingPart);
}

// Examples:
// 0.1 SOL = 7 segments
// 0.5 SOL = 15 segments
// 1.0 SOL = 25 segments
// 2.0 SOL = 35 segments
// 5.0 SOL = 65 segments
// 10.0 SOL = 115 segments
```

**Rationale:**
- Prevents extreme size advantages for whales
- Still rewards higher stakes
- Maintains competitive balance
- Easier to implement and understand

## 2. Kill Reward Calculation

### 2.1 Reward Distribution

**When Player A kills Player B:**

```typescript
interface KillReward {
  victimStake: number;      // Total stake of killed player
  killerReward: number;     // 90% goes to killer
  buybackAmount: number;    // 10% goes to buyback pool
}

function calculateKillReward(victimStake: number): KillReward {
  const killerRewardPercentage = 0.90; // 90%
  const buybackPercentage = 0.10;      // 10%
  
  return {
    victimStake,
    killerReward: victimStake * killerRewardPercentage,
    buybackAmount: victimStake * buybackPercentage
  };
}
```

**Example Scenarios:**

| Victim Stake | Killer Gets (90%) | Buyback Pool (10%) |
|--------------|-------------------|-------------------|
| 0.1 SOL | 0.09 SOL | 0.01 SOL |
| 0.5 SOL | 0.45 SOL | 0.05 SOL |
| 1.0 SOL | 0.90 SOL | 0.10 SOL |
| 5.0 SOL | 4.50 SOL | 0.50 SOL |

### 2.2 Dynamic Growth System

**Killer's Snake Growth:**

```typescript
function calculateKillGrowth(rewardAmount: number): number {
  // Convert reward to additional segments
  // Using same formula as initial stake
  const additionalSegments = Math.floor(rewardAmount * 20);
  return additionalSegments;
}

// Example: Kill someone with 0.5 SOL
// Reward: 0.45 SOL
// Growth: 0.45 * 20 = 9 additional segments
```

### 2.3 Kill Streak Bonuses (Optional)

```typescript
interface KillStreak {
  consecutiveKills: number;
  bonusMultiplier: number;
}

function getKillStreakBonus(consecutiveKills: number): number {
  if (consecutiveKills >= 10) return 1.50; // +50% bonus
  if (consecutiveKills >= 5) return 1.25;  // +25% bonus
  if (consecutiveKills >= 3) return 1.10;  // +10% bonus
  return 1.0; // No bonus
}
```

## 3. Withdraw Fee Logic

### 3.1 Fee Calculation

```typescript
interface WithdrawCalculation {
  currentStake: number;
  hasKilledInSession: boolean;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
}

function calculateWithdrawFee(
  currentStake: number,
  hasKilledInSession: boolean
): WithdrawCalculation {
  const feePercentage = hasKilledInSession ? 0 : 10; // 10% if no kills
  const feeAmount = hasKilledInSession 
    ? 0 
    : currentStake * 0.10;
  const netAmount = currentStake - feeAmount;
  
  return {
    currentStake,
    hasKilledInSession,
    feePercentage,
    feeAmount,
    netAmount
  };
}
```

### 3.2 Fee Scenarios

**Scenario 1: Player with kills**
```
Initial stake: 0.5 SOL
Killed 2 players: +0.8 SOL
Current stake: 1.3 SOL
Has killed: YES
Fee: 0%
Receives: 1.3 SOL
```

**Scenario 2: Player without kills**
```
Initial stake: 0.5 SOL
Current stake: 0.5 SOL
Has killed: NO
Fee: 10% = 0.05 SOL
Receives: 0.45 SOL
To buyback: 0.05 SOL
```

**Scenario 3: Player ate food but no kills**
```
Initial stake: 0.5 SOL
Current stake: 0.5 SOL (no change from kills)
Has killed: NO
Fee: 10% = 0.05 SOL
Receives: 0.45 SOL
```

## 4. Death & Respawn Logic

### 4.1 Death Handling

```typescript
interface DeathEvent {
  deadPlayerId: string;
  killerPlayerId: string | null;
  deadPlayerStake: number;
  killerReward: number;
  buybackAmount: number;
  foodSpawned: number;
}

function handlePlayerDeath(
  deadPlayer: Player,
  killer: Player | null
): DeathEvent {
  const stake = deadPlayer.stakeAmount;
  
  if (killer) {
    // Death by another player
    const { killerReward, buybackAmount } = calculateKillReward(stake);
    
    // Update killer
    killer.stakeAmount += killerReward;
    killer.hasKilled = true;
    killer.kills += 1;
    
    // Add segments to killer's snake
    const additionalSegments = calculateKillGrowth(killerReward);
    for (let i = 0; i < additionalSegments; i++) {
      killer.addSegment();
    }
    
    // Spawn food from dead player
    const foodCount = spawnFoodFromDeadPlayer(deadPlayer);
    
    // Update dead player
    deadPlayer.stakeAmount = 0;
    deadPlayer.alive = false;
    
    return {
      deadPlayerId: deadPlayer.id,
      killerPlayerId: killer.id,
      deadPlayerStake: stake,
      killerReward,
      buybackAmount,
      foodSpawned: foodCount
    };
  } else {
    // Death by wall/boundary
    deadPlayer.stakeAmount = 0;
    deadPlayer.alive = false;
    
    return {
      deadPlayerId: deadPlayer.id,
      killerPlayerId: null,
      deadPlayerStake: stake,
      killerReward: 0,
      buybackAmount: 0,
      foodSpawned: 0
    };
  }
}
```

### 4.2 Food Spawning from Dead Players

```typescript
function spawnFoodFromDeadPlayer(deadPlayer: Player): number {
  const segmentCount = deadPlayer.segments.length;
  
  // Spawn food at random segments (not all, to avoid clutter)
  const foodCount = Math.min(
    Math.floor(segmentCount / 3),
    20 // Max 20 food pieces
  );
  
  for (let i = 0; i < foodCount; i++) {
    const randomSegmentIndex = Math.floor(Math.random() * segmentCount);
    const segment = deadPlayer.segments[randomSegmentIndex];
    
    // Add slight randomness to position
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = (Math.random() - 0.5) * 40;
    
    spawnFood(
      segment.position.x + offsetX,
      segment.position.y + offsetY,
      1 // Normal food value
    );
  }
  
  return foodCount;
}
```

### 4.3 Respawn Logic

```typescript
function handleRespawn(player: Player): void {
  // Player must stake again to respawn
  // This is handled through the UI flow:
  // 1. Player dies
  // 2. Death screen shows
  // 3. Player clicks "Respawn"
  // 4. Redirected to Stake screen
  // 5. Must stake SOL again
  // 6. Rejoins game with new snake
  
  // Reset player state
  player.alive = true;
  player.score = 0;
  player.kills = 0;
  player.hasKilled = false;
  player.segments.clear();
  
  // New stake will determine new size
  // This is handled in onJoin() with new stake amount
}
```

## 5. Collision Detection Updates

### 5.1 Head-to-Body Collision

```typescript
function checkPlayerCollisions(player: Player, allPlayers: Player[]): void {
  if (!player.alive) return;
  
  const head = player.segments[0];
  const headRadius = 8;
  const segmentRadius = 6;
  
  // Check collision with other players
  for (const otherPlayer of allPlayers) {
    if (otherPlayer.id === player.id || !otherPlayer.alive) continue;
    
    // Skip invulnerability period (3 seconds after spawn/respawn)
    if (player.invulnerable) continue;
    
    // Check collision with other player's body (skip head)
    for (let i = 1; i < otherPlayer.segments.length; i++) {
      const segment = otherPlayer.segments[i];
      const distance = calculateDistance(head.position, segment.position);
      
      if (distance < headRadius + segmentRadius) {
        // Collision detected!
        handlePlayerDeath(player, otherPlayer);
        return;
      }
    }
  }
  
  // Check collision with world boundaries (if enabled)
  if (worldBoundaryCollisions) {
    if (isOutOfBounds(head.position)) {
      handlePlayerDeath(player, null);
    }
  }
}
```

### 5.2 Size-Based Collision Advantage

```typescript
// Optional: Larger snakes have slightly larger collision radius
function getCollisionRadius(player: Player): number {
  const baseRadius = 8;
  const sizeBonus = Math.min(player.segments.length * 0.1, 4); // Max +4 radius
  return baseRadius + sizeBonus;
}
```

## 6. Speed & Movement Updates

### 6.1 Size-Based Speed Adjustment

```typescript
function calculateMovementSpeed(player: Player): number {
  const baseSpeed = 3;
  const segmentCount = player.segments.length;
  
  // Larger snakes move slightly slower for balance
  let speedMultiplier = 1.0;
  
  if (segmentCount > 50) {
    speedMultiplier = 0.9; // -10% speed
  } else if (segmentCount > 100) {
    speedMultiplier = 0.8; // -20% speed
  } else if (segmentCount > 150) {
    speedMultiplier = 0.7; // -30% speed
  }
  
  // Apply boost if active
  if (player.boosting) {
    speedMultiplier *= 2.0; // Double speed when boosting
  }
  
  return baseSpeed * speedMultiplier;
}
```

### 6.2 Boost Mechanics

```typescript
function handleBoost(player: Player, deltaTime: number): void {
  if (!player.boosting || !player.alive) return;
  
  // Cost: Consume 1 segment per 500ms of boosting
  player.boostTime += deltaTime;
  
  if (player.boostTime >= 500) {
    player.boostTime = 0;
    
    // Only allow boost if player has enough segments
    if (player.segments.length > 5) {
      // Remove last segment
      player.segments.pop();
      
      // Decrease stake proportionally
      const segmentValue = player.stakeAmount / player.segments.length;
      player.stakeAmount -= segmentValue;
      player.score = Math.max(0, player.score - 1);
    } else {
      // Not enough segments, disable boost
      player.boosting = false;
    }
  }
}
```

## 7. Food System Updates

### 7.1 Food Types

```typescript
enum FoodType {
  NORMAL = 1,      // +1 score, +1 segment
  SPECIAL = 5,     // +5 score, +3 segments (5% spawn rate)
  BONUS = 10,      // +10 score, +5 segments (1% spawn rate)
}

interface Food {
  id: string;
  position: Vector2;
  value: FoodType;
  color: string;
}

function spawnFood(): Food {
  const random = Math.random();
  let type: FoodType;
  let color: string;
  
  if (random < 0.01) {
    type = FoodType.BONUS;
    color = '#FF00FF'; // Purple
  } else if (random < 0.06) {
    type = FoodType.SPECIAL;
    color = '#FFD700'; // Gold
  } else {
    type = FoodType.NORMAL;
    color = '#00FF00'; // Green
  }
  
  return {
    id: generateFoodId(),
    position: getRandomPosition(),
    value: type,
    color
  };
}
```

### 7.2 Food Consumption

```typescript
function handleFoodConsumption(player: Player, food: Food): void {
  // Add score
  player.score += food.value;
  
  // Add segments based on food type
  const segmentsToAdd = food.value > 1 
    ? Math.floor(food.value / 2) 
    : 1;
  
  for (let i = 0; i < segmentsToAdd; i++) {
    player.addSegment();
  }
  
  // Note: Food consumption does NOT increase stake
  // Stake only increases from killing other players
  
  // Remove food
  this.state.foods.delete(food.id);
  
  // Broadcast to all clients
  this.broadcast("foodConsumed", {
    foodId: food.id,
    playerId: player.id,
    value: food.value
  });
  
  // Spawn new food to maintain count
  this.spawnFood();
}
```

## 8. Edge Cases & Special Scenarios

### 8.1 Simultaneous Deaths

```typescript
function handleSimultaneousCollision(
  player1: Player,
  player2: Player
): void {
  // Both players hit each other's body at the same time
  // Solution: Both die, stakes go to buyback pool
  
  const totalStake = player1.stakeAmount + player2.stakeAmount;
  
  player1.stakeAmount = 0;
  player1.alive = false;
  
  player2.stakeAmount = 0;
  player2.alive = false;
  
  // All stakes go to buyback
  this.addToBuybackPool(totalStake);
  
  // Spawn food from both players
  spawnFoodFromDeadPlayer(player1);
  spawnFoodFromDeadPlayer(player2);
  
  this.broadcast("simultaneousDeath", {
    player1Id: player1.id,
    player2Id: player2.id,
    totalStake
  });
}
```

### 8.2 Player Disconnection

```typescript
function handlePlayerDisconnect(player: Player): void {
  if (!player.alive || player.stakeAmount === 0) {
    // Player already dead or withdrew, just remove
    this.state.players.delete(player.id);
    return;
  }
  
  // Player disconnected while alive with stake
  // Options:
  
  // Option 1: Treat as voluntary exit (apply 10% fee if no kills)
  const { feeAmount, netAmount } = calculateWithdrawFee(
    player.stakeAmount,
    player.hasKilled
  );
  
  // Queue withdrawal transaction
  this.stakeService.processWithdraw(player.walletAddress, netAmount);
  
  if (feeAmount > 0) {
    this.addToBuybackPool(feeAmount);
  }
  
  // Option 2: Grace period (30 seconds to reconnect)
  // Keep player in game as AI-controlled or frozen
  // If reconnect fails, then treat as Option 1
  
  this.state.players.delete(player.id);
}
```

### 8.3 Minimum Viable Stake

```typescript
function enforceMinimumStake(player: Player): void {
  const minimumStake = 0.01; // 0.01 SOL minimum to stay in game
  
  if (player.stakeAmount < minimumStake && player.alive) {
    // Force player out of game
    this.broadcast("minimumStakeNotMet", {
      playerId: player.id,
      currentStake: player.stakeAmount
    });
    
    // Auto-withdraw remaining stake
    this.stakeService.processWithdraw(
      player.walletAddress,
      player.stakeAmount
    );
    
    player.stakeAmount = 0;
    player.alive = false;
  }
}
```

## 9. Leaderboard & Stats

### 9.1 Leaderboard Calculation

```typescript
interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  walletAddress: string;
  currentStake: number;
  totalEarned: number;
  kills: number;
  deaths: number;
  killDeathRatio: number;
  longestSnake: number;
  playTime: number;
}

function calculateLeaderboard(): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  
  // Get all players sorted by total earned
  const sortedPlayers = Array.from(this.state.players.values())
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 100); // Top 100
  
  sortedPlayers.forEach((player, index) => {
    entries.push({
      rank: index + 1,
      playerId: player.id,
      playerName: player.name,
      walletAddress: player.walletAddress,
      currentStake: player.stakeAmount,
      totalEarned: player.totalEarned,
      kills: player.kills,
      deaths: player.deaths,
      killDeathRatio: player.deaths > 0 
        ? player.kills / player.deaths 
        : player.kills,
      longestSnake: player.maxLength,
      playTime: player.totalPlayTime
    });
  });
  
  return entries;
}
```

## 10. Configuration Constants

```typescript
// server/src/config/game.config.ts

export const GAME_CONFIG = {
  // Snake sizing
  BASE_SNAKE_SIZE: 5,
  SIZE_MULTIPLIER: 20,
  
  // Stake limits
  MIN_STAKE_SOL: 0.1,
  MAX_STAKE_SOL: 10.0,
  MIN_VIABLE_STAKE: 0.01,
  
  // Rewards & fees
  KILL_REWARD_PERCENTAGE: 90,
  BUYBACK_PERCENTAGE: 10,
  WITHDRAW_FEE_PERCENTAGE: 10,
  
  // Speed & movement
  BASE_SPEED: 3,
  BOOST_MULTIPLIER: 2.0,
  BOOST_COST_INTERVAL_MS: 500,
  
  // Collision
  HEAD_RADIUS: 8,
  SEGMENT_RADIUS: 6,
  INVULNERABILITY_DURATION_MS: 3000,
  
  // World
  WORLD_WIDTH: 4000,
  WORLD_HEIGHT: 3000,
  MAX_FOOD_COUNT: 100,
  
  // Food spawn rates
  SPECIAL_FOOD_CHANCE: 0.05,  // 5%
  BONUS_FOOD_CHANCE: 0.01,    // 1%
  
  // Timing
  TICK_RATE_MS: 16,  // ~60 FPS
  
  // Buyback
  BUYBACK_THRESHOLD_SOL: 1.0,
};
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-07

