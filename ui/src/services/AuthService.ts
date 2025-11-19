import bs58 from 'bs58';
import { apiService } from './ApiService';
import type { 
    PhantomProvider, 
    NonceResponse, 
    LoginResult, 
    UserProfile,
    AuthTokens 
} from '../types/Auth.types';

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'auth_access_token',
    REFRESH_TOKEN: 'auth_refresh_token',
    WALLET_ADDRESS: 'wallet_address',
    USER_PROFILE: 'user_profile',
};

class AuthService {
    private provider: PhantomProvider | null = null;
    private walletAddress: string | null = null;
    private phantomInstalledCache: boolean | null = null;

    constructor() {
        // Load saved auth data on init
        this.loadSavedAuth();
    }

    /**
     * Check if Phantom wallet is installed (cached to avoid repeated window.solana access)
     */
    isPhantomInstalled(): boolean {
        // Cache the result to avoid repeated access to window.solana
        // which can trigger Phantom popup
        if (this.phantomInstalledCache !== null) {
            return this.phantomInstalledCache;
        }
        
        this.phantomInstalledCache = typeof window !== 'undefined' && 
               window.solana !== undefined && 
               window.solana.isPhantom === true;
        
        return this.phantomInstalledCache;
    }

    /**
     * Get Phantom provider
     */
    private getProvider(): PhantomProvider {
        if (!this.isPhantomInstalled()) {
            throw new Error('Phantom wallet is not installed. Please install it from https://phantom.app/');
        }
        
        if (!this.provider) {
            this.provider = window.solana!;
        }
        
        return this.provider;
    }

    /**
     * Connect to Phantom wallet
     * Only calls provider.connect() if not already connected
     */
    async connectPhantom(): Promise<string> {
        try {
            const provider = this.getProvider();
            
            // Check if already connected by checking publicKey
            // This avoids unnecessary connect() calls that trigger popup
            if (provider.publicKey) {
                const existingAddress = provider.publicKey.toString();
                // If we have a saved wallet address and it matches, use it
                if (this.walletAddress === existingAddress) {
                    console.log('✅ Already connected to Phantom:', this.walletAddress);
                    return this.walletAddress;
                }
                // If publicKey exists but doesn't match saved address, update it
                this.walletAddress = existingAddress;
                localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, this.walletAddress);
                console.log('✅ Using existing Phantom connection:', this.walletAddress);
                return this.walletAddress;
            }
            
            // Only call connect() if not already connected
            // This is the only place that should trigger the popup
            const response = await provider.connect();
            this.walletAddress = response.publicKey.toString();
            
            // Save wallet address
            localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, this.walletAddress);
            
            console.log('✅ Connected to Phantom:', this.walletAddress);
            return this.walletAddress;
        } catch (error) {
            console.error('❌ Error connecting to Phantom:', error);
            throw new Error('Failed to connect to Phantom wallet');
        }
    }

    /**
     * Disconnect from Phantom wallet
     */
    async disconnect(): Promise<void> {
        try {
            if (this.provider) {
                await this.provider.disconnect();
            }
            
            // Clear all stored data
            this.clearAuth();
            this.walletAddress = null;
            // Reset cache so it will be re-checked next time
            this.phantomInstalledCache = null;
            
            console.log('✅ Disconnected from Phantom');
        } catch (error) {
            console.error('❌ Error disconnecting:', error);
        }
    }

    /**
     * Request nonce from server
     */
    async requestNonce(walletAddress: string): Promise<string> {
        try {
            const response = await apiService.post<NonceResponse>('/auth/nonce', {
                walletAddress
            });

            return response?.nonce;
        } catch (error) {
            console.error('❌ Error requesting nonce:', error);
            throw new Error('Failed to request nonce from server');
        }
    }

    /**
     * Sign message with Phantom
     */
    async signMessage(message: string): Promise<string> {
        try {
            const provider = this.getProvider();
            
            // Convert message to Uint8Array
            const encodedMessage = new TextEncoder().encode(message);
            
            // Request signature
            const { signature } = await provider.signMessage(encodedMessage, 'utf8');
            
            // Convert signature to base58
            const signatureBase58 = bs58.encode(signature);
            
            console.log('✅ Message signed successfully');
            return signatureBase58;
        } catch (error) {
            console.error('❌ Error signing message:', error);
            throw new Error('Failed to sign message with Phantom');
        }
    }

    /**
     * Verify signature and login
     */
    async verifyAndLogin(
        walletAddress: string, 
        nonce: string, 
        signature: string,
        referralCode?: string
    ): Promise<LoginResult> {
        try {
            const payload: any = {
                walletAddress,
                nonce,
                signature
            };
            
            // Add referral code if provided
            if (referralCode) {
                payload.referralCode = referralCode;
                console.log('📝 Sending referral code to backend:', referralCode);
            }
            
            const response = await apiService.post<LoginResult>('/auth/verify', payload);
            
            // apiService.post already returns response.data (BaseResponse.data)
            // So response is already the LoginResult: { user, tokens }
            const loginResult = response;
            
            console.log('✅ Login successful. User referred by:', loginResult?.user?.referredById || 'None');
            
            // Save tokens and user info
            this.saveAuth(loginResult);
            
            return loginResult;
        } catch (error) {
            console.error('❌ Error verifying signature:', error);
            throw new Error('Failed to verify signature');
        }
    }

    /**
     * Complete login flow
     */
    async login(referralCode?: string): Promise<LoginResult> {
        try {
            // Step 1: Connect to Phantom
            const walletAddress = await this.connectPhantom();
            
            // Step 2: Request nonce
            const nonce = await this.requestNonce(walletAddress);
            
            // Step 3: Sign nonce
            const signature = await this.signMessage(nonce);
            
            // Step 4: Verify and get JWT (with referral code if provided)
            const loginResult = await this.verifyAndLogin(walletAddress, nonce, signature, referralCode);
            
            return loginResult;
        } catch (error) {
            console.error('❌ Login failed:', error);
            throw error;
        }
    }

    /**
     * Refresh access token
     */
    async refreshToken(): Promise<void> {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }
            
            const response = await apiService.post<LoginResult>('/auth/refresh', {
                refreshToken
            });
            
            this.saveAuth(response);
            console.log('✅ Token refreshed successfully');
        } catch (error) {
            console.error('❌ Error refreshing token:', error);
            this.clearAuth();
            throw error;
        }
    }

    /**
     * Logout
     */
    async logout(): Promise<void> {
        try {
            const accessToken = this.getAccessToken();
            if (accessToken) {
                await apiService.post('/auth/logout', {});
            }
        } catch (error) {
            console.error('❌ Error during logout:', error);
        } finally {
            await this.disconnect();
        }
    }

    /**
     * Get current user profile
     */
    async getProfile(): Promise<UserProfile | null> {
        try {
            // apiService.get already returns response.data (BaseResponse.data)
            // So response is already the UserProfile
            const response = await apiService.get<UserProfile>('/auth/me');
            return response;
        } catch (error) {
            console.error('❌ Error fetching profile:', error);
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return !!this.getAccessToken() && !!this.walletAddress;
    }

    /**
     * Get wallet address
     */
    getWalletAddress(): string | null {
        return this.walletAddress;
    }

    /**
     * Get access token
     */
    getAccessToken(): string | null {
        return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    }

    /**
     * Get refresh token
     */
    getRefreshToken(): string | null {
        return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    }

    /**
     * Get user profile from storage
     */
    getUserProfile(): UserProfile | null {
        const profileStr = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
        if (!profileStr) return null;
        
        try {
            return JSON.parse(profileStr);
        } catch {
            return null;
        }
    }

    /**
     * Save authentication data
     */
    private saveAuth(loginResult: LoginResult): void {
        const { user, tokens } = loginResult;
        
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
        localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, user.walletAddress);
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
        
        this.walletAddress = user.walletAddress;
    }

    /**
     * Clear authentication data
     */
    private clearAuth(): void {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
        localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    }

    /**
     * Load saved authentication data
     */
    private loadSavedAuth(): void {
        this.walletAddress = localStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS);
    }

    /**
     * Format wallet address for display (e.g., "CWZDCm...2TrNz")
     */
    formatWalletAddress(address: string): string {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-5)}`;
    }
}

// Export singleton instance
export const authService = new AuthService();



