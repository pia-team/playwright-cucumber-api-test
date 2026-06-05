import { Given, Then, BeforeStep, AfterStep } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { getAccessToken } from '../auth/auth.step';
import { logger } from '../../../utils/logger';
import { ReportHelper } from '../../../utils/reportHelper';

// Global variables for sharing between steps
declare global {
  var currentResponse: any;
  var currentService: any;
  var currentAuthToken: string;
}

BeforeStep(function (step) {
  const stepText = step.pickleStep?.text || 'Unknown Step';
  ReportHelper.startStep(stepText);
});

AfterStep(function (step) {
  const stepText = step.pickleStep?.text || 'Unknown Step';
  const resultStatus = step.result?.status || 'SKIPPED';
  const status = resultStatus === 'PASSED' ? 'passed' : 
                 resultStatus === 'FAILED' ? 'failed' : 'skipped';
  const error = step.result?.message || undefined;
  
  ReportHelper.endStep(
    stepText,
    status,
    error
  );
});

Given('I have a valid authorization token from the response', async () => {
  logger.logStep('Given', 'I have a valid authorization token from the response');
  
  // Get token from auth step response
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Access token not found. Please ensure token was obtained in previous steps.');
  }
  
  (global as any).currentAuthToken = token;
  logger.info('Authorization token obtained from auth response');
  
  // Service initialization will be done in feature-specific steps
  // This step only stores the token globally
});

Then('the response status should be {int}', async (status: number) => {
  logger.logStep('Then', `the response status should be ${status}`);
  
  // Try to get response from global variable
  const response = (global as any).response || (global as any).currentResponse;
  
  if (!response) {
    throw new Error('Response not found. Make sure a request was made in previous steps.');
  }
  
  expect(response.status()).toBe(status);
  logger.info(`Response status verified: ${status}`);
});

/** GET list/retrieve: GCU APIs may return 200 or 206 depending on resource. */
Then('the response status should be 200 or 206', async () => {
  logger.logStep('Then', 'the response status should be 200 or 206');

  const response = (global as any).response || (global as any).currentResponse;

  if (!response) {
    throw new Error('Response not found. Make sure a request was made in previous steps.');
  }

  const status = response.status();
  expect([200, 206]).toContain(status);
  logger.info(`Response status verified: ${status} (accepted 200 or 206)`);
});

Then('the response should contain an error message', async () => {
  logger.logStep('Then', 'the response should contain an error message');

  const response = (global as any).response || (global as any).currentResponse;
  if (!response) {
    throw new Error('Response not found. Make sure a request was made in previous steps.');
  }

  const body = await response.json();
  expect(body.reason || body.message || body.code || body.error).toBeTruthy();
  logger.info('Error message verified in response');
});

Then('the response body should contain an error message', async () => {
  logger.logStep('Then', 'the response body should contain an error message');

  const response = (global as any).response || (global as any).currentResponse;
  if (!response) {
    throw new Error('Response not found. Make sure a request was made in previous steps.');
  }

  const body = await response.json();
  expect(body.reason || body.message || body.code || body.error).toBeTruthy();
  logger.info('Error message verified in response body');
});

Then('the response body should be a JSON array', async () => {
  logger.logStep('Then', 'the response body should be a JSON array');

  const response = (global as any).response || (global as any).currentResponse;
  if (!response) {
    throw new Error('Response not found. Make sure a request was made in previous steps.');
  }

  const json = await response.json();
  expect(Array.isArray(json)).toBe(true);
  logger.info('Response body verified as JSON array');
});

Then('the response body should be an array', async () => {
  logger.logStep('Then', 'the response body should be an array');

  const response = (global as any).response || (global as any).currentResponse;
  if (!response) {
    throw new Error('Response not found. Make sure a request was made in previous steps.');
  }

  const json = await response.json();
  expect(Array.isArray(json)).toBe(true);
  logger.info('Response body verified as array');
});
