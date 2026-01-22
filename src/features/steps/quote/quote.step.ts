import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import { logger } from '../../../utils/logger';
import { ServiceHelper } from '../../../utils/serviceHelper';
import { ResponseHelper } from '../../../utils/responseHelper';
import { QuoteService } from '../../../services/quoteService';
import { endpoints } from '../../../config/endpoints';
import { QuoteCreate, QuoteUpdate, Quote } from '../../../models/quote.model';
import { expect } from 'chai';

setDefaultTimeout(60 * 1000);

let quoteService: QuoteService;
let response: any;
let createdQuote: Quote;
let queryParams: { [key: string]: any } = {};

Given('I initialize quote service with authorization token', async () => {
  logger.logStep('Given', 'I initialize quote service with authorization token');
  quoteService = await ServiceHelper.initializeQuoteService();
});

When('I send a GET request to the list quotes endpoint', async () => {
  logger.logStep('When', 'I send a GET request to the list quotes endpoint');
  queryParams = { limit: 10 };
  response = await quoteService.listQuotes(queryParams);
  const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.list}`;
  await ResponseHelper.logAndSetResponse(response, 'GET', url, queryParams);
});

When('I send a POST request to create a quote with valid data', async () => {
  logger.logStep('When', 'I send a POST request to create a quote with valid data');
  const body: QuoteCreate = {
    description: 'A test quote created via automation',
    category: 'residential',
    externalId: `test-ext-${Date.now()}`,
    relatedParty: [{
      id: 'test-customer-123',
      role: 'Customer',
      '@referredType': 'Customer',
    }],
    quoteItem: [{
      id: '1',
      action: 'add',
      quantity: 1,
      productOffering: {
        id: 'some-product-offering-id',
        href: `${endpoints.quoteManagement.baseURI}/productOffering/some-product-offering-id`,
        version: '1.0',
        name: 'Standard Internet Plan'
      }
    }],
  };
  response = await quoteService.createQuote(body);
  const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.create}`;
  await ResponseHelper.logAndSetResponse(response, 'POST', url, body);
  if (response.status === 201) {
    createdQuote = await ResponseHelper.getResponseBody(response);
  }
});

When('I send a POST request to create a quote with an empty body', async () => {
    logger.logStep('When', 'I send a POST request to create a quote with an empty body');
    const body = {};
    response = await quoteService.createQuote(body as QuoteCreate);
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.create}`;
    await ResponseHelper.logAndSetResponse(response, 'POST', url, body);
});

When('I send a GET request to retrieve the quote by its created ID', async () => {
  logger.logStep('When', 'I send a GET request to retrieve the quote by its created ID');
  expect(createdQuote, 'A quote must have been created first').to.exist;
  response = await quoteService.retrieveQuote(createdQuote.id);
  const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.byId(createdQuote.id)}`;
  await ResponseHelper.logAndSetResponse(response, 'GET', url);
});

When('I send a GET request to the retrieve quote endpoint with id "{string}"', async (id: string) => {
  logger.logStep('When', `I send a GET request to the retrieve quote endpoint with id "${id}"`);
  response = await quoteService.retrieveQuote(id);
  const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.byId(id)}`;
  await ResponseHelper.logAndSetResponse(response, 'GET', url);
});

When("I send a PATCH request to update the quote's description", async () => {
  logger.logStep("When", "I send a PATCH request to update the quote's description");
  expect(createdQuote, 'A quote must have been created first').to.exist;
  const newDescription = `Updated description at ${new Date().toISOString()}`;
  const body: QuoteUpdate = {
    description: newDescription,
  };
  response = await quoteService.patchQuote(createdQuote.id, body);
  const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.update(createdQuote.id)}`;
  await ResponseHelper.logAndSetResponse(response, 'PATCH', url, body);
});

When('I send a DELETE request for the created quote', async () => {
    logger.logStep('When', 'I send a DELETE request for the created quote');
    expect(createdQuote, 'A quote must have been created first').to.exist;
    response = await quoteService.deleteQuote(createdQuote.id);
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.delete(createdQuote.id)}`;
    await ResponseHelper.logAndSetResponse(response, 'DELETE', url);
});

Then('the response should be a valid list of quotes', async () => {
  logger.logStep('Then', 'the response should be a valid list of quotes');
  await ResponseHelper.validateArrayResponse(response, 'Quote');
});

Then('the response should contain a valid created quote', async () => {
  logger.logStep('Then', 'the response should contain a valid created quote');
  const body = await ResponseHelper.getResponseBody(response);
  expect(body.id).to.be.a('string');
  expect(body.state).to.exist;
  expect(body.quoteItem).to.be.an('array').with.lengthOf.at.least(1);
});

Then('the response should contain the correct quote details', async () => {
  logger.logStep('Then', 'the response should contain the correct quote details');
  const body = await ResponseHelper.getResponseBody(response);
  expect(body.id).to.equal(createdQuote.id);
  expect(body.externalId).to.equal(createdQuote.externalId);
});

Then("the response should contain the updated quote description", async () => {
  logger.logStep("Then", "the response should contain the updated quote description");
  const body = await ResponseHelper.getResponseBody(response);
  expect(body.description).to.not.equal(createdQuote.description);
  expect(body.description).to.include('Updated description');
});