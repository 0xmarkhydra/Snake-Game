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
    credit: number | string;
}

export interface WithdrawRequest {
    recipientAddress: string;
    amount: number;
}

export interface WithdrawResponse {
    signature: string;
    transactionId: string;
    recipientAddress: string;
    amount: number;
    mintAddress: string;
    senderAddress: string;
    tokenAccountCreated: boolean;
    availableAmount: number | string;
}

export interface WithdrawResult {
    success: boolean;
    message?: string;
    data?: WithdrawResponse;
    retryAfter?: number;
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
    publicKey?: any;
    connect(): Promise<{ publicKey: any }>;
    disconnect?: () => Promise<void>;
    signTransaction?: (transaction: any) => Promise<any>;
    signMessage?(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
    on?(event: string, callback: () => void): void;
    removeListener?(event: string, callback: () => void): void;
}

