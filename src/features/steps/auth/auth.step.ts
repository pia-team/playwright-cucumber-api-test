import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../utils/logger';
import { AuthHelper } from '../../../utils/authHelper';
import { ResponseHelper } from '../../../utils/responseHelper';

let tokenRequest: any;
let response: any;

Given('I have authentication credentials for user {string}', async (username: string) => {
  logger.logStep('Given', `I have authentication credentials for user "${username}"`);
  tokenRequest = await AuthHelper.getCredentialsForUser(username);
  await AuthHelper.initializeAuthService();
});

Given('I have invalid authentication credentials', async () => {
  logger.logStep('Given', 'I have invalid authentication credentials');
  tokenRequest = AuthHelper.getInvalidCredentials();
  await AuthHelper.initializeAuthService();
});

Given('I have authentication credentials with missing fields', async () => {
  logger.logStep('Given', 'I have authentication credentials with missing fields');
  tokenRequest = AuthHelper.getMissingCredentials();
  await AuthHelper.initializeAuthService();
});

When('I send a POST request to get access token', async () => {
  logger.logStep('When', 'I send a POST request to get access token');
  response = await AuthHelper.getToken(tokenRequest);
});

Then('the response should contain access token', async () => {
  logger.logStep('Then', 'the response should contain access token');
  const tokenResponse = await ResponseHelper.validateTokenResponse(response);
  AuthHelper.setTokenResponse(tokenResponse);
});

Then('the token type should be {string}', async (tokenType: string) => {
  logger.logStep('Then', `the token type should be "${tokenType}"`);
  const tokenResponse = AuthHelper.getTokenResponse();
  await ResponseHelper.validateTokenType(response, tokenResponse, tokenType);
});

// Export token for use in other steps
export function getTokenResponse() {
  return AuthHelper.getTokenResponse();
}

export function getAccessToken(): string | null {
  return AuthHelper.getAccessToken();
}
