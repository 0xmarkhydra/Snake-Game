export type RoomType = 'free' | 'vip';

export interface VipRoomConfig {
    entryFee: number;
    rewardRatePlayer: number;
    rewardRateTreasury: number;
    respawnCost: number;
    maxClients: number;
    tickRate: number;
    metadata?: Record<string, unknown>;
}

export interface VipTicketInfo {
    id: string;
    ticketCode: string;
    entryFee: string;
    status: string;
    roomType: string;
    roomInstanceId?: string;
    expiresAt?: string;
    consumedAt?: string;
}

export interface VipAccessCheckResult {
    canJoin: boolean;
    credit: number;
    ticket?: VipTicketInfo;
    config?: VipRoomConfig;
    reason?: string;
}


