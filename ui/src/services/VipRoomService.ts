import { apiService } from './ApiService';
import type { VipAccessCheckResult, VipRoomConfig, VipTicketInfo } from '../types/Game.types';

type StandardResponse<T> = {
    data: T;
    msg: string;
    status_code: number;
    timestamp: string;
};

type VipAccessRawResponse = {
    canJoin: boolean;
    credit: string | number;
    ticket?: VipTicketInfo;
    config?: {
        entryFee?: string | number;
        rewardRatePlayer?: string | number;
        rewardRateTreasury?: string | number;
        respawnCost?: string | number;
        maxClients?: number;
        tickRate?: number;
        metadata?: Record<string, unknown>;
    };
    reason?: string;
};

class VipRoomService {
    async checkAccess(): Promise<VipAccessCheckResult> {
        const response = await apiService.post<StandardResponse<VipAccessRawResponse>>(
            '/game/rooms/vip/check',
            { roomType: 'snake_game_vip' }
        );

        const payload = this.extractData(response);

        return {
            canJoin: payload.canJoin,
            credit: this.parseNumber(payload.credit),
            ticket: payload.ticket,
            config: payload.config ? this.parseConfig(payload.config) : undefined,
            reason: payload.reason,
        };
    }

    private extractData<T>(payload: T | StandardResponse<T>): T {
        if ((payload as StandardResponse<T>)?.data) {
            return (payload as StandardResponse<T>).data;
        }
        return payload as T;
    }

    private parseNumber(value: string | number | undefined): number {
        if (value === undefined) {
            return 0;
        }
        const parsed = typeof value === 'string' ? parseFloat(value) : value;
        return Number.isFinite(parsed) ? Number(parsed) : 0;
    }

    private parseConfig(config: VipAccessRawResponse['config']): VipRoomConfig {
        return {
            entryFee: this.parseNumber(config?.entryFee),
            rewardRatePlayer: this.parseNumber(config?.rewardRatePlayer),
            rewardRateTreasury: this.parseNumber(config?.rewardRateTreasury),
            respawnCost: this.parseNumber(config?.respawnCost),
            maxClients: config?.maxClients ?? 20,
            tickRate: config?.tickRate ?? 60,
            metadata: config?.metadata ?? {},
        };
    }
}

export const vipRoomService = new VipRoomService();


