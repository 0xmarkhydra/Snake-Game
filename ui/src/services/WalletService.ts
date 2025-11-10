import { apiService } from './ApiService';
import type { WalletBalance } from '../types/Auth.types';

const STORAGE_KEYS = {
    CREDIT: 'wallet_credit',
};

class WalletService {
    private credit: number = 0;
    private pollingInterval: number | null = null;

    constructor() {
        // Load saved credit
        this.loadSavedCredit();
    }

    /**
     * Get current credit balance from server
     */
    async getCredit(): Promise<number> {
        try {
            const response = await apiService.get<{ data: WalletBalance }>('/wallet/credit');
            this.credit = response.data.credit;
            
            // Save to storage
            this.saveCredit(this.credit);
            
            return this.credit;
        } catch (error) {
            console.error('❌ Error fetching credit:', error);
            // Return cached credit if API fails
            return this.credit;
        }
    }

    /**
     * Get cached credit (from memory)
     */
    getCachedCredit(): number {
        return this.credit;
    }

    /**
     * Start polling credit balance
     */
    startPolling(intervalMs: number = 2000): void {
        // Clear existing interval if any
        this.stopPolling();
        
        // Poll immediately
        this.getCredit();
        
        // Then poll at interval
        this.pollingInterval = window.setInterval(() => {
            this.getCredit();
        }, intervalMs);
        
        console.log(`🔄 Started polling credit every ${intervalMs}ms`);
    }

    /**
     * Stop polling credit balance
     */
    stopPolling(): void {
        if (this.pollingInterval !== null) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('⏹️ Stopped polling credit');
        }
    }

    /**
     * Request withdrawal
     */
    async withdraw(amount: number): Promise<boolean> {
        try {
            await apiService.post('/wallet/withdraw', { amount });
            
            // Update credit
            await this.getCredit();
            
            console.log(`✅ Withdrawal successful: ${amount} credits`);
            return true;
        } catch (error) {
            console.error('❌ Error withdrawing:', error);
            return false;
        }
    }

    /**
     * Check if user has enough credit
     */
    hasEnoughCredit(requiredAmount: number = 1): boolean {
        return this.credit >= requiredAmount;
    }

    /**
     * Save credit to storage
     */
    private saveCredit(credit: number): void {
        localStorage.setItem(STORAGE_KEYS.CREDIT, credit.toString());
    }

    /**
     * Load saved credit from storage
     */
    private loadSavedCredit(): void {
        const savedCredit = localStorage.getItem(STORAGE_KEYS.CREDIT);
        if (savedCredit) {
            this.credit = parseFloat(savedCredit) || 0;
        }
    }

    /**
     * Clear credit data
     */
    clearCredit(): void {
        this.credit = 0;
        localStorage.removeItem(STORAGE_KEYS.CREDIT);
    }

    /**
     * Format credit for display
     */
    formatCredit(credit?: number): string {
        const value = credit !== undefined ? credit : this.credit;
        return value.toFixed(2);
    }
}

// Export singleton instance
export const walletService = new WalletService();

