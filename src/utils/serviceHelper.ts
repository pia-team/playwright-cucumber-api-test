import { getAccessToken } from '../features/steps/auth/auth.step';
import { logger } from './logger';

export class ServiceHelper {
  static async getTokenFromTestDataOrEnv(): Promise<string> {
    const fromAuthStep = getAccessToken();
    if (fromAuthStep) {
      logger.debug('Authorization token from auth step');
      return fromAuthStep;
    }
    const token = process.env.API_TOKEN || '';
    if (token) {
      logger.debug('Authorization token from API_TOKEN environment variable');
    }
    return token;
  }

  static async getTokenFromAuthResponse(): Promise<string> {
    const token = (global as any).currentAuthToken || getAccessToken();

    if (!token) {
      throw new Error('Access token not found. Please ensure token was obtained in previous steps.');
    }

    return token;
  }
}
