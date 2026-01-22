import { ApiContext } from '../core/api/apiContext';
import { ApiClient } from '../core/api/apiClient';
import { CatalogService } from '../services/catalogService';
import { CategoryService } from '../services/categoryService';
import { QuoteService } from '../services/quoteService';
import { HubService } from '../services/hubService';
import { TestDataHelper } from './testDataHelper';
import { getAccessToken } from '../features/steps/auth/auth.step';
import { logger } from './logger';

export class ServiceHelper {
  static async getTokenFromTestDataOrEnv(): Promise<string> {
    try {
      const testData = TestDataHelper.getData<{ token: string }>('auth.json');
      logger.debug('Authorization token loaded from test data');
      return testData.token;
    } catch {
      const token = process.env.API_TOKEN || '';
      logger.debug('Authorization token loaded from environment variable');
      return token;
    }
  }

  static async getTokenFromAuthResponse(): Promise<string> {
    const token = (global as any).currentAuthToken || getAccessToken();
    
    if (!token) {
      throw new Error('Access token not found. Please ensure token was obtained in previous steps.');
    }
    
    return token;
  }

  static async initializeCatalogService(token?: string): Promise<CatalogService> {
    const authToken = token || await this.getTokenFromAuthResponse();
    logger.info('Initializing catalog service with authorization token');
    
    const context = await ApiContext.createWithAuth(authToken);
    const service = new CatalogService(new ApiClient(context));
    
    logger.info('Catalog service initialized');
    return service;
  }

  static async initializeCategoryService(token?: string): Promise<CategoryService> {
    const authToken = token || await this.getTokenFromAuthResponse();
    logger.info('Initializing category service with authorization token');
    
    const context = await ApiContext.createWithAuth(authToken);
    const service = new CategoryService(new ApiClient(context));
    
    logger.info('Category service initialized');
    return service;
  }

  static async initializeQuoteService(token?: string): Promise<QuoteService> {
    const authToken = token || await this.getTokenFromAuthResponse();
    logger.info('Initializing quote service with authorization token');
    
    const context = await ApiContext.createWithAuth(authToken);
    const service = new QuoteService(new ApiClient(context));
    
    logger.info('Quote service initialized');
    return service;
  }

  static async initializeHubService(token?: string): Promise<HubService> {
    const authToken = token || await this.getTokenFromAuthResponse();
    logger.info('Initializing hub service with authorization token');
    
    const context = await ApiContext.createWithAuth(authToken);
    const service = new HubService(new ApiClient(context));
    
    logger.info('Hub service initialized');
    return service;
  }
}
