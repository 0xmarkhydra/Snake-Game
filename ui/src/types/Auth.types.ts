// Authentication types for Phantom wallet integration

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshTokenExpiresAt: string;
}

export interface UserProfile {
    id: string;
    walletAddress: string;
    displayName?: string;
    avatarUrl?: string;
}

export interface LoginResult {
    user: UserProfile;
    tokens: AuthTokens;
}

export interface NonceResponse {
    nonce: string;
}

export interface WalletBalance {
    credit: number;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: UserProfile | null;
    walletAddress: string | null;
    credit: number;
}

// Phantom wallet types
export interface PhantomProvider {
    isPhantom?: boolean;
    connect(): Promise<{ publicKey: { toString(): string } }>;
    disconnect(): Promise<void>;
    signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
    on(event: string, callback: () => void): void;
    removeListener(event: string, callback: () => void): void;
}

declare global {
    interface Window {
        solana?: PhantomProvider;
    }
}

