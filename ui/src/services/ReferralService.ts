import { apiService } from './ApiService';

export interface ReferralCodeResponse {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: string;
  earnedFromKills: string;
  earnedFromDeaths: string;
}

export interface ReferralStatsItem {
  refereeId: string;
  refereeWallet: string;
  refereeDisplayName?: string;
  joinedAt: string;
  totalEarned: string;
  earnedFromKills: string;
  earnedFromDeaths: string;
  lastActivityAt?: string;
}

export interface ReferralStatsResponse {
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: string;
  earnedFromKills: string;
  earnedFromDeaths: string;
  referrals: ReferralStatsItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ValidateReferralCodeResponse {
  valid: boolean;
  referrerWallet?: string;
  referrerDisplayName?: string;
}

class ReferralService {
  /**
   * Get referral code and basic stats for current user
   */
  async getMyReferralCode(): Promise<ReferralCodeResponse> {
    try {
      const response = await apiService.get<any>('/referral/my-code');
      console.log('Raw referral code response:', response);
      
      // Backend returns BaseResponse format: { data: T, msg, status_code, timestamp }
      const referralData = response?.data || response;
      
      if (!referralData || (!referralData.referralCode && referralData.referralCode !== '')) {
        console.warn('Referral code not found in response:', referralData);
      }
      
      return referralData as ReferralCodeResponse;
    } catch (error) {
      console.error('❌ Error fetching referral code:', error);
      throw new Error('Failed to fetch referral code');
    }
  }

  /**
   * Get detailed referral statistics
   */
  async getReferralStats(page: number = 1, limit: number = 10): Promise<ReferralStatsResponse> {
    try {
      const response = await apiService.get<any>(
        `/referral/stats?page=${page}&limit=${limit}`
      );
      console.log('Raw referral stats response:', response);
      
      // Backend returns BaseResponse format: { data: T, msg, status_code, timestamp }
      const statsData = response?.data || response;
      
      return statsData as ReferralStatsResponse;
    } catch (error) {
      console.error('❌ Error fetching referral stats:', error);
      throw new Error('Failed to fetch referral stats');
    }
  }

  /**
   * Validate referral code (public endpoint)
   */
  async validateReferralCode(referralCode: string): Promise<ValidateReferralCodeResponse> {
    try {
      // Normalize to uppercase before sending
      const normalizedCode = referralCode.toUpperCase().trim();
      const response = await apiService.post<any>('/referral/validate', {
        referralCode: normalizedCode,
      });
      
      // Backend returns BaseResponse format: { data: T, msg, status_code, timestamp }
      const result = response?.data || response;
      return result as ValidateReferralCodeResponse;
    } catch (error) {
      console.error('❌ Error validating referral code:', error);
      return { valid: false };
    }
  }

  /**
   * Copy referral link to clipboard
   */
  async copyReferralLink(referralLink: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(referralLink);
      return true;
    } catch (error) {
      console.error('❌ Error copying to clipboard:', error);
      return false;
    }
  }

  /**
   * Get referral code from URL query params
   */
  getReferralCodeFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref');
  }
}

// Export singleton instance
export const referralService = new ReferralService();

