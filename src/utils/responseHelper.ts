import { expect } from '@playwright/test';
import { logger } from './logger';

export class ResponseHelper {
  static setGlobalResponse(response: any): void {
    (global as any).response = response;
  }

  static getGlobalResponse(): any {
    return (global as any).response || (global as any).currentResponse;
  }

  static async logAndSetResponse(response: any, method: string, url: string, params?: any): Promise<any> {
    logger.logRequest(method, url, undefined, params);
    
    this.setGlobalResponse(response);
    
    const status = response.status();
    logger.logResponse(status, response.statusText(), response.headers());
    
    return response;
  }

  static async validateStatus(response: any, expectedStatus: number): Promise<void> {
    const actualStatus = response.status();
    expect(actualStatus).toBe(expectedStatus);
    logger.info(`Response status verified: ${expectedStatus}`);
  }

  static async validateContentType(response: any, expectedType: string): Promise<void> {
    const headers = response.headers();
    expect(headers['content-type']).toContain(expectedType);
    logger.info(`Response content type verified: ${expectedType}`);
  }

  static async getResponseBody(response: any): Promise<any> {
    return await response.json();
  }

  static async validateArrayResponse(response: any, itemName: string = 'items'): Promise<void> {
    const responseBody = await this.getResponseBody(response);
    expect(responseBody).toBeDefined();
    
    if (Array.isArray(responseBody)) {
      logger.info(`${itemName} list contains ${responseBody.length} items`);
    } else if (responseBody.data && Array.isArray(responseBody.data)) {
      logger.info(`${itemName} list contains ${responseBody.data.length} items`);
      expect(responseBody.data).toBeDefined();
    } else {
      logger.warn('Response structure is different than expected');
    }
    
    logger.debug('Response body:', responseBody);
  }

  static async validateItemCount(response: any, maxCount: number | string): Promise<void> {
    const responseBody = await this.getResponseBody(response);
    const max = typeof maxCount === 'string' ? parseInt(maxCount, 10) : maxCount;
    
    let itemCount = 0;
    if (Array.isArray(responseBody)) {
      itemCount = responseBody.length;
    } else if (responseBody.data && Array.isArray(responseBody.data)) {
      itemCount = responseBody.data.length;
    }
    
    expect(itemCount).toBeLessThanOrEqual(max);
    logger.info(`Verified: Response contains ${itemCount} items (max: ${max})`);
  }

  static async validateTokenResponse(response: any): Promise<any> {
    const responseBody = await this.getResponseBody(response);
    expect(responseBody).toBeDefined();
    expect(responseBody.access_token).toBeDefined();
    expect(responseBody.access_token).not.toBe('');
    
    logger.info('Access token verified in response');
    logger.debug(`Token expires in: ${responseBody.expires_in} seconds`);
    
    return responseBody;
  }

  static async validateTokenType(response: any, tokenResponse: any, expectedType: string): Promise<void> {
    let token = tokenResponse;
    if (!token) {
      token = await this.getResponseBody(response);
    }
    
    expect(token.token_type).toBe(expectedType);
    logger.info(`Token type verified: ${expectedType}`);
  }
}
