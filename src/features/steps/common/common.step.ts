import { Given, Then, BeforeStep, AfterStep } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ApiContext } from '../../../core/api/apiContext';
import { ApiClient } from '../../../core/api/apiClient';
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
