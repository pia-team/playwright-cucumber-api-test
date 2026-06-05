import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../../utils/logger';
import { ResponseHelper } from '../../../../utils/responseHelper';
import { ServiceHelper } from '../../../../utils/serviceHelper';
import { ApiContext } from '../../../../core/api/apiContext';
import { ApiClient } from '../../../../core/api/apiClient';
import { QuoteManagementService } from '../../../../services/quoteManagementService';
import { buildApiUrl } from '../../../../utils/apiUrl';
import { endpoints } from '../../../../config/quoteManagement.endpoints';
import { requireResponseId } from '../../../../utils/strictHelpers';
import { expect } from '@playwright/test';

const FEATURE = 'quoteManagement';

let service: QuoteManagementService;
let apiClient: ApiClient;
let response: any;
let createdQuoteId: string;
let validDescription: string;

Given('I initialize the ' + FEATURE + ' service', async function () {
  logger.logStep('Given', 'I initialize the ' + FEATURE + ' service');
  const token = await ServiceHelper.getTokenFromAuthResponse();
  const authContext = await ApiContext.createWithAuth(token);
  apiClient = new ApiClient(authContext);
  service = new QuoteManagementService(apiClient);
});

When('I create a quote with valid payload for ' + FEATURE, async function () {
  logger.logStep('When', 'I create a quote with valid payload for ' + FEATURE);
  validDescription = `Test Quote ${Date.now()}`;
  const payload = { description: validDescription };
  response = await service.createQuote(payload);
  await ResponseHelper.logAndSetResponse(
    response,
    'POST',
    buildApiUrl(endpoints.quote.baseURI, endpoints.quote.create)
  );
  const body = await response.json();
  createdQuoteId = requireResponseId(body.id, 'quote');
});

When('I create a quote with invalid payload for ' + FEATURE, async function () {
  logger.logStep('When', 'I create a quote with invalid payload for ' + FEATURE);
  const invalidPayload = { quoteItem: [{ id: '01' }] };
  const url = buildApiUrl(endpoints.quote.baseURI, endpoints.quote.create);
  response = await apiClient.post(url, invalidPayload as any);
  await ResponseHelper.logAndSetResponse(response, 'POST', url);
});

When('I send a GET request to list quotes for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to list quotes for ' + FEATURE);
  response = await service.listQuotes();
  await ResponseHelper.logAndSetResponse(
    response,
    'GET',
    buildApiUrl(endpoints.quote.baseURI, endpoints.quote.list)
  );
});

When('I send a GET request to retrieve the quote by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve the quote by id for ' + FEATURE);
  response = await service.retrieveQuote(createdQuoteId);
  await ResponseHelper.logAndSetResponse(
    response,
    'GET',
    buildApiUrl(endpoints.quote.baseURI, endpoints.quote.byId(createdQuoteId))
  );
});

When('I send a GET request to retrieve a non-existent quote by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve a non-existent quote by id for ' + FEATURE);
  response = await service.retrieveQuote('non-existent-id');
  await ResponseHelper.logAndSetResponse(
    response,
    'GET',
    buildApiUrl(endpoints.quote.baseURI, endpoints.quote.byId('non-existent-id'))
  );
});

When('I send a PATCH request to update the quote for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a PATCH request to update the quote for ' + FEATURE);
  const updatePayload = { description: `Updated Quote ${Date.now()}` };
  response = await service.updateQuote(createdQuoteId, updatePayload);
  await ResponseHelper.logAndSetResponse(
    response,
    'PATCH',
    buildApiUrl(endpoints.quote.baseURI, endpoints.quote.byId(createdQuoteId))
  );
});

When('I send a DELETE request to delete the quote for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a DELETE request to delete the quote for ' + FEATURE);
  response = await service.deleteQuote(createdQuoteId);
  await ResponseHelper.logAndSetResponse(
    response,
    'DELETE',
    buildApiUrl(endpoints.quote.baseURI, endpoints.quote.byId(createdQuoteId))
  );
});

Then('the response body should contain an id field for ' + FEATURE, async function () {
  logger.logStep('Then', 'the response body should contain an id field for ' + FEATURE);
  const body = await response.json();
  expect(body).toHaveProperty('id');
});

Then('the response body should contain the saved id for ' + FEATURE, async function () {
  logger.logStep('Then', 'the response body should contain the saved id for ' + FEATURE);
  const body = await response.json();
  expect(body.id).toBe(createdQuoteId);
});