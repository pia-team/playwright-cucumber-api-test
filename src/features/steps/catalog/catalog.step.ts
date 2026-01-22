import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../utils/logger';
import { ServiceHelper } from '../../../utils/serviceHelper';
import { ResponseHelper } from '../../../utils/responseHelper';
import { CatalogService } from '../../../services/catalogService';
import { endpoints } from '../../../config/endpoints';

let catalogService: CatalogService;
let response: any;
let queryParams: { limit?: number; sort?: string; offset?: number } = {};

Given('I have a valid authorization token', async () => {
  logger.logStep('Given', 'I have a valid authorization token');
  const token = await ServiceHelper.getTokenFromTestDataOrEnv();
  catalogService = await ServiceHelper.initializeCatalogService(token);
});

Given('I initialize catalog service with authorization token', async () => {
  logger.logStep('Given', 'I initialize catalog service with authorization token');
  catalogService = await ServiceHelper.initializeCatalogService();
});

When('I send a GET request to the catalog list endpoint', async () => {
  logger.logStep('When', 'I send a GET request to the catalog list endpoint');
  response = await catalogService.getCatalogs(queryParams);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.productCatalogManagement.catalog.list, queryParams);
});

When('I send a GET request to the catalog list endpoint with limit {string} and sort {string}', async (limit: string, sort: string) => {
  logger.logStep('When', `I send a GET request to the catalog list endpoint with limit "${limit}" and sort "${sort}"`);
  
  queryParams = {
    limit: parseInt(limit, 10),
    sort: sort
  };
  
  response = await catalogService.getCatalogs(queryParams);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.productCatalogManagement.catalog.list, queryParams);
});

When('I send a GET request to the catalog list endpoint with limit {int}', async (limit: number) => {
  logger.logStep('When', `I send a GET request to the catalog list endpoint with limit ${limit}`);
  
  queryParams = { limit };
  response = await catalogService.getCatalogs(queryParams);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.productCatalogManagement.catalog.list, queryParams);
});

Then('the response should contain catalog list data', async () => {
  logger.logStep('Then', 'the response should contain catalog list data');
  await ResponseHelper.validateArrayResponse(response, 'Catalog');
});

Then('the response should contain at most {string} items', async (maxItems: string) => {
  logger.logStep('Then', `the response should contain at most "${maxItems}" items`);
  await ResponseHelper.validateItemCount(response, maxItems);
});

Then('the response should contain at most {int} items', async (maxItems: number) => {
  logger.logStep('Then', `the response should contain at most ${maxItems} items`);
  await ResponseHelper.validateItemCount(response, maxItems);
});
