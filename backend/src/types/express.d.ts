import { TJWTPayload } from '@/shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: TJWTPayload;
    }
  }
}

export {};
