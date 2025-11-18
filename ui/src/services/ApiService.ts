import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ENV } from '../configs/env';

// Create a base Axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
    baseURL: ENV.API_URL,
    timeout: 10000, // 10 seconds
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Flag to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

// Request interceptor for adding auth tokens, etc.
apiClient.interceptors.request.use(
    (config) => {
        // Add authentication token if available
        const token = localStorage.getItem('auth_access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for handling common responses
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        // Handle common errors (401, 403, 500, etc.)
        if (error.response) {
            const { status } = error.response;
            
            // Handle 401 Unauthorized - try to refresh token
            if (status === 401 && !originalRequest._retry) {
                // Skip refresh for auth endpoints
                if (originalRequest.url?.includes('/auth/')) {
                    console.error('Unauthorized access. Please login again.');
                    // Clear auth if refresh or login fails
                    if (originalRequest.url?.includes('/auth/refresh')) {
                        localStorage.removeItem('auth_access_token');
                        localStorage.removeItem('auth_refresh_token');
                        localStorage.removeItem('wallet_address');
                        localStorage.removeItem('user_profile');
                    }
                    return Promise.reject(error);
                }

                // If already retried, don't try again
                if (originalRequest._retry) {
                    return Promise.reject(error);
                }

                // If already refreshing, queue this request
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then(() => {
                            originalRequest.headers.Authorization = `Bearer ${localStorage.getItem('auth_access_token')}`;
                            return apiClient(originalRequest);
                        })
                        .catch(err => Promise.reject(err));
                }

                originalRequest._retry = true;
                isRefreshing = true;

                const refreshToken = localStorage.getItem('auth_refresh_token');
                if (!refreshToken) {
                    console.error('No refresh token available. Please login again.');
                    processQueue(error);
                    isRefreshing = false;
                    // Clear auth
                    localStorage.removeItem('auth_access_token');
                    localStorage.removeItem('auth_refresh_token');
                    localStorage.removeItem('wallet_address');
                    localStorage.removeItem('user_profile');
                    return Promise.reject(error);
                }

                try {
                    console.log('🔄 Refreshing access token...');
                    const response = await axios.post(`${ENV.API_URL}/auth/refresh`, {
                        refreshToken
                    });

                    const { data } = response;
                    const loginResult = data?.data || data;
                    
                    if (loginResult?.tokens?.accessToken) {
                        // Save new tokens
                        localStorage.setItem('auth_access_token', loginResult.tokens.accessToken);
                        localStorage.setItem('auth_refresh_token', loginResult.tokens.refreshToken);
                        
                        console.log('✅ Token refreshed successfully');
                        
                        // Update authorization header
                        originalRequest.headers.Authorization = `Bearer ${loginResult.tokens.accessToken}`;
                        
                        // Process queued requests
                        processQueue();
                        isRefreshing = false;
                        
                        // Retry the original request
                        return apiClient(originalRequest);
                    } else {
                        throw new Error('Invalid refresh response');
                    }
                } catch (refreshError) {
                    console.error('❌ Token refresh failed:', refreshError);
                    processQueue(refreshError);
                    isRefreshing = false;
                    
                    // Clear auth data
                    localStorage.removeItem('auth_access_token');
                    localStorage.removeItem('auth_refresh_token');
                    localStorage.removeItem('wallet_address');
                    localStorage.removeItem('user_profile');
                    
                    return Promise.reject(refreshError);
                }
            }
            
            // Handle other status codes
            switch (status) {
                case 403:
                    console.error('Forbidden access. You do not have permission.');
                    break;
                case 404:
                    console.error('Resource not found.');
                    break;
                case 500:
                    console.error('Server error. Please try again later.');
                    break;
                default:
                    if (status !== 401) {
                        console.error(`Request failed with status code ${status}`);
                    }
            }
        } else if (error.request) {
            console.error('No response received from server. Check your network connection.');
        } else {
            console.error('Error setting up request:', error.message);
        }
        
        return Promise.reject(error);
    }
);

// Generic API service class
class ApiService {
    // GET request
    async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.get(url, config);
        return response.data;
    }

    // POST request
    async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.post(url, data, config);
        return response.data;
    }

    // PUT request
    async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.put(url, data, config);
        return response.data;
    }

    // PATCH request
    async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.patch(url, data, config);
        return response.data;
    }

    // DELETE request
    async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.delete(url, config);
        return response.data;
    }
}

// Export as a singleton
export const apiService = new ApiService(); 