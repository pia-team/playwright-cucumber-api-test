import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import { logger } from '../../../utils/logger';
import { ServiceHelper } from '../../../utils/serviceHelper';
import { ResponseHelper } from '../../../utils/responseHelper';
import { HubService } from '../../../services/hubService';
import { endpoints } from '../../../config/endpoints';
import { EventSubscriptionInput, EventSubscription } from '../../../models/hub.model';
import { expect } from 'chai';

setDefaultTimeout(60 * 1000);

let hubService: HubService;
let response: any;
let createdListener: EventSubscription;

Given('I initialize hub service with authorization token', async () => {
  logger.logStep('Given', 'I initialize hub service with authorization token');
  hubService = await ServiceHelper.initializeHubService();
});

When('I send a GET request to the list listeners endpoint', async () => {
  logger.logStep('When', 'I send a GET request to the list listeners endpoint');
  response = await hubService.listListeners();
  const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.hub.list}`;
  await ResponseHelper.logAndSetResponse(response, 'GET', url);
});

When('I send a POST request to register a listener with a valid callback', async () => {
  logger.logStep('When', 'I send a POST request to register a listener with a valid callback');
  const body: EventSubscriptionInput = {
    callback: `https://webhook.site/test-callback-${Date.now()}`,
    query: 'eventType=quoteStateChange'
  };
  response = await hubService.registerListener(body);
  const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.hub.register}`;
  await ResponseHelper.logAndSetResponse(response, 'POST', url, body);
  if (response.status === 201) {
    createdListener = await ResponseHelper.getResponseBody(response);
  }
});

When('I send a POST request to register a listener with an empty body', async () => {
    logger.logStep('When', 'I send a POST request to register a listener with an empty body');
    const body = {};
    response = await hubService.registerListener(body as EventSubscriptionInput);
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.hub.register}`;
    await ResponseHelper.logAndSetResponse(response, 'POST', url, body);
});

When('I send a DELETE request for the created listener', async () => {
    logger.logStep('When', 'I send a DELETE request for the created listener');
    expect(createdListener, 'A listener must have been created first').to.exist;
    response = await hubService.unregisterListener(createdListener.id);
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.hub.unregister(createdListener.id)}`;
    await ResponseHelper.logAndSetResponse(response, 'DELETE', url);
});

Then('the response should contain a valid list of listeners', async () => {
  logger.logStep('Then', 'the response should contain a valid list of listeners');
  await ResponseHelper.validateArrayResponse(response, 'EventSubscription');
});

Then('the response should contain the registered listener details', async () => {
  logger.logStep('Then', 'the response should contain the registered listener details');
  const body = await ResponseHelper.getResponseBody(response);
  expect(body.id).to.be.a('string').and.not.be.empty;
  expect(body.callback).to.include('https://webhook.site/test-callback-');
});

Then('the response should contain an error message', async () => {
    logger.logStep('Then', 'the response should contain an error message');
    const body = await ResponseHelper.getResponseBody(response);
    expect(body).to.have.property('reason');
    expect(body.reason).to.not.be.empty;
});