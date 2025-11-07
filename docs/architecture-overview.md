# Architecture Overview - Snake Game with Solana Integration

## 1. System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React + Phaser UI]
        WA[Wallet Adapter]
        CC[Colyseus Client]
    end
    
    subgraph "Server Layer"
        GS[Game Server - Colyseus]
        API[REST API]
        SS[Solana Service]
        TS[Token Service]
    end
    
    subgraph "Blockchain Layer"
        SN[Solana Network]
        SP[Stake Pool Program]
        DEX[DEX - Raydium/Jupiter]
        TOKEN[Project Token]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL)]
        CACHE[(Redis Cache)]
    end
    
    UI --> WA
    UI --> CC
    WA --> SN
    CC --> GS
    UI --> API
    
    API --> SS
    API --> TS
    API --> DB
    
    SS --> SN
    SS --> SP
    TS --> DEX
    TS --> TOKEN
    
    GS --> DB
    GS --> CACHE
    GS --> SS

```

## 2. Tech Stack

### Frontend (UI)
- **Framework**: React 18.2.0 + TypeScript 5.2.2
- **Game Engine**: Phaser 3.88.2
- **Build Tool**: Vite 5.3.1
- **Wallet Integration**: 
  - `@solana/wallet-adapter-react` ^0.15.x
  - `@solana/wallet-adapter-wallets` ^0.19.x
  - `@solana/wallet-adapter-react-ui` ^0.9.x
- **Solana SDK**: `@solana/web3.js` ^1.87.x
- **State Management**: React Context + Colyseus State
- **UI Components**: Custom + Phaser UI

### Backend (Server)
- **Framework**: Node.js + TypeScript
- **Real-time**: Colyseus 0.15.x
- **API Framework**: Express.js 4.x
- **Solana SDK**: 
  - `@solana/web3.js` ^1.87.x
  - `@solana/spl-token` ^0.3.x
- **Database**: PostgreSQL 15.x (via `pg` or `typeorm`)
- **Cache**: Redis 7.x (optional, for performance)
- **Job Queue**: Bull (for async token buyback/burn)

### Blockchain
- **Network**: Solana Mainnet-beta / Devnet
- **Smart Contract**: Anchor Framework 0.29.x (Rust)
- **DEX Integration**: Jupiter Aggregator API
- **Token Standard**: SPL Token

### DevOps
- **Version Control**: Git
- **Package Manager**: pnpm
- **Environment**: Docker (optional)
- **Monitoring**: Custom logging + Error tracking

## 3. Core Components

### 3.1 Client Components

```
ui/src/
├── components/
│   ├── wallet/
│   │   ├── WalletConnectButton.tsx
│   │   ├── WalletProvider.tsx
│   │   └── WalletBalance.tsx
│   ├── stake/
│   │   ├── StakeModal.tsx
│   │   ├── WithdrawModal.tsx
│   │   └── StakeDisplay.tsx
│   └── game/
│       ├── GameHUD.tsx
│       ├── Leaderboard.tsx
│       └── KillNotification.tsx
├── contexts/
│   ├── WalletContext.tsx
│   └── GameContext.tsx
├── services/
│   ├── WalletService.ts
│   ├── SolanaService.ts
│   ├── StakeService.ts
│   └── ColyseusClient.ts (existing)
└── game/scenes/
    ├── WalletConnectScene.ts (new)
    ├── StakeScene.ts (new)
    ├── MenuScene.ts (updated)
    └── GameScene.ts (updated)
```

### 3.2 Server Components

```
server/src/
├── services/
│   ├── SolanaService.ts
│   ├── WalletService.ts
│   ├── StakeService.ts
│   ├── TokenService.ts
│   └── TransactionService.ts
├── repositories/
│   ├── PlayerRepository.ts
│   ├── TransactionRepository.ts
│   └── StakePoolRepository.ts
├── rooms/
│   └── SnakeGameRoom.ts (updated)
├── schema/
│   └── SnakeGameState.ts (updated)
├── api/
│   ├── routes/
│   │   ├── wallet.routes.ts
│   │   ├── stake.routes.ts
│   │   └── token.routes.ts
│   └── middlewares/
│       ├── auth.middleware.ts
│       └── validation.middleware.ts
├── jobs/
│   ├── BuybackJob.ts
│   └── BurnJob.ts
└── utils/
    ├── solana.utils.ts
    └── calculation.utils.ts
```

## 4. Data Flow Diagrams

### 4.1 Connect & Stake Flow

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant Wallet
    participant API
    participant Solana
    participant GameServer
    
    User->>UI: Click "Connect Wallet"
    UI->>Wallet: Request connection
    Wallet->>UI: Return wallet pubkey
    
    User->>UI: Enter stake amount (0.1 SOL)
    UI->>UI: Validate amount
    UI->>Wallet: Request transaction signature
    Wallet->>Solana: Send SOL to Stake Pool
    Solana->>Wallet: Confirm transaction
    
    UI->>API: POST /api/stake/deposit {wallet, amount, txHash}
    API->>Solana: Verify transaction
    API->>API: Calculate snake size
    API->>GameServer: Register player with stake
    GameServer->>UI: Return player ID & initial state
    
    UI->>GameServer: Join game room
    GameServer->>UI: Spawn snake with calculated size
```

### 4.2 Kill & Reward Flow

```mermaid
sequenceDiagram
    actor Winner
    actor Loser
    participant GameServer
    participant StakeService
    participant Solana
    participant TokenService
    
    Winner->>GameServer: Snake collision detected
    GameServer->>GameServer: Validate kill
    GameServer->>StakeService: Process kill reward
    
    StakeService->>StakeService: Calculate: 90% to winner, 10% to buyback
    StakeService->>Solana: Transfer 90% to winner wallet
    StakeService->>TokenService: Queue 10% for buyback
    
    TokenService->>TokenService: Accumulate buyback amount
    TokenService->>Solana: Swap SOL -> Project Token (via DEX)
    TokenService->>Solana: Burn tokens
    
    GameServer->>Winner: Update stake amount
    GameServer->>Loser: Mark as dead, stake = 0
    GameServer->>Winner: Show kill notification
    GameServer->>Loser: Show death screen
```

### 4.3 Withdraw Flow

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant API
    participant GameServer
    participant Solana
    participant TokenService
    
    User->>UI: Click "Withdraw"
    UI->>API: GET /api/stake/calculate-withdraw
    API->>API: Check hasKilled flag
    
    alt Has NOT killed anyone
        API->>API: Calculate fee = stake * 10%
        API->>UI: Return {amount, fee, net}
        UI->>User: Show warning "10% fee applies"
    else Has killed someone
        API->>API: fee = 0
        API->>UI: Return {amount, fee: 0, net}
    end
    
    User->>UI: Confirm withdraw
    UI->>API: POST /api/stake/withdraw {confirm: true}
    
    alt With fee
        API->>Solana: Transfer (stake - 10%) to user
        API->>TokenService: Queue 10% for buyback
    else No fee
        API->>Solana: Transfer full stake to user
    end
    
    API->>GameServer: Remove player from game
    GameServer->>UI: Disconnect & show summary
```

## 5. Database Schema

### 5.1 Tables

#### **players**
```sql
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    username VARCHAR(50),
    total_staked DECIMAL(18, 9) DEFAULT 0,
    current_stake DECIMAL(18, 9) DEFAULT 0,
    total_earned DECIMAL(18, 9) DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    has_killed_current_session BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_players_wallet ON players(wallet_address);
```

#### **transactions**
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id),
    type VARCHAR(20) NOT NULL, -- 'STAKE', 'WITHDRAW', 'KILL_REWARD', 'DEATH_LOSS'
    amount DECIMAL(18, 9) NOT NULL,
    fee DECIMAL(18, 9) DEFAULT 0,
    tx_hash VARCHAR(88), -- Solana transaction signature
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'FAILED'
    metadata JSONB, -- Additional data
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_player ON transactions(player_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
```

#### **game_sessions**
```sql
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id),
    room_id VARCHAR(50) NOT NULL,
    initial_stake DECIMAL(18, 9) NOT NULL,
    final_stake DECIMAL(18, 9),
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    max_length INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

CREATE INDEX idx_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_sessions_room ON game_sessions(room_id);
```

#### **stake_pool**
```sql
CREATE TABLE stake_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_staked DECIMAL(18, 9) DEFAULT 0,
    total_withdrawn DECIMAL(18, 9) DEFAULT 0,
    pending_buyback DECIMAL(18, 9) DEFAULT 0,
    total_bought_back DECIMAL(18, 9) DEFAULT 0,
    total_burned DECIMAL(18, 9) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **buyback_transactions**
```sql
CREATE TABLE buyback_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sol_amount DECIMAL(18, 9) NOT NULL,
    token_amount DECIMAL(18, 9),
    burn_amount DECIMAL(18, 9),
    swap_tx_hash VARCHAR(88),
    burn_tx_hash VARCHAR(88),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

## 6. Security Considerations

### 6.1 Wallet Security
- ✅ Never store private keys on server
- ✅ Verify transaction signatures on blockchain
- ✅ Implement rate limiting for transactions
- ✅ Use HTTPS for all API calls
- ✅ Validate wallet ownership via signed messages

### 6.2 Game Security
- ✅ Server-authoritative game logic (prevent cheating)
- ✅ Validate all kill events on server
- ✅ Prevent stake manipulation
- ✅ Transaction confirmation before game join
- ✅ Timeout handling for pending transactions

### 6.3 Smart Contract Security
- ✅ Audit smart contract before mainnet
- ✅ Implement emergency pause mechanism
- ✅ Multi-sig for admin operations
- ✅ Upgradeable contract pattern (if needed)
- ✅ Test on devnet extensively

### 6.4 Financial Security
- ✅ Atomic transactions for stake/withdraw
- ✅ Double-entry bookkeeping in database
- ✅ Transaction idempotency (prevent double-spend)
- ✅ Regular reconciliation with blockchain state
- ✅ Monitor for suspicious patterns

## 7. Performance Considerations

### 7.1 Client Side
- Lazy load wallet adapters
- Cache wallet balance
- Optimize Phaser rendering
- Debounce transaction checks

### 7.2 Server Side
- Redis cache for active stakes
- Connection pooling for database
- Rate limiting per wallet
- Batch blockchain queries
- Async token buyback (queue system)

### 7.3 Blockchain
- Use Solana RPC with high rate limits (e.g., Helius, QuickNode)
- Implement retry logic for failed transactions
- Priority fees for faster confirmation
- Batch token burns (accumulate before burning)

## 8. Environment Variables

### Server (.env)
```bash
# Solana
SOLANA_NETWORK=mainnet-beta # or devnet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_STAKE_POOL_ADDRESS=...
SOLANA_PROJECT_TOKEN_MINT=...
SOLANA_FEE_PAYER_PRIVATE_KEY=... # Server wallet for fees

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/snakegame
REDIS_URL=redis://localhost:6379

# API
API_PORT=3000
JWT_SECRET=...

# Game
MIN_STAKE_AMOUNT=0.1
MAX_STAKE_AMOUNT=10
KILL_REWARD_PERCENTAGE=90
BUYBACK_PERCENTAGE=10
WITHDRAW_FEE_PERCENTAGE=10

# Token
DEX_API_URL=https://quote-api.jup.ag/v6
BUYBACK_THRESHOLD=1.0 # Minimum SOL to trigger buyback
```

### Client (.env)
```bash
VITE_SOLANA_NETWORK=mainnet-beta
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_API_URL=http://localhost:3000/api
VITE_COLYSEUS_SERVER_URL=ws://localhost:2567
VITE_STAKE_POOL_ADDRESS=...
VITE_PROJECT_TOKEN_MINT=...
```

## 9. Deployment Architecture

```
┌─────────────────┐
│   Cloudflare    │ (CDN + DDoS protection)
└────────┬────────┘
         │
┌────────▼────────┐
│   Load Balancer │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│ API  │  │ Game │ (Multiple instances)
│Server│  │Server│
└───┬──┘  └──┬───┘
    │        │
    └────┬───┘
         │
    ┌────▼────┐
    │   DB    │ (PostgreSQL + Redis)
    └─────────┘
         │
    ┌────▼────┐
    │ Solana  │ (RPC Node)
    │ Network │
    └─────────┘
```

## 10. Next Steps

1. ✅ Review and approve architecture
2. 📝 Detailed design documents for each component
3. 🔨 Set up development environment
4. 🎯 Phase 1: Database + Basic API
5. 🎯 Phase 2: Solana integration
6. 🎯 Phase 3: Smart contract development
7. 🎯 Phase 4: Frontend wallet integration
8. 🎯 Phase 5: Game logic updates
9. 🧪 Testing & security audit
10. 🚀 Deployment

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-07  
**Author**: AI Assistant

