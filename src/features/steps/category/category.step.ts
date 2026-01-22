import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../utils/logger';
import { ServiceHelper } from '../../../utils/serviceHelper';
import { ResponseHelper } from '../../../utils/responseHelper';
import { CategoryService } from '../../../services/categoryService';
import { endpoints } from '../../../config/endpoints';

let categoryService: CategoryService;
let response: any;

Given('I have a valid authorization token', async () => {
  logger.logStep('Given', 'I have a valid authorization token');
  const token = await ServiceHelper.getTokenFromTestDataOrEnv();
  categoryService = await ServiceHelper.initializeCategoryService(token);
});

Given('I initialize category service with authorization token', async () => {
  logger.logStep('Given', 'I initialize category service with authorization token');
  categoryService = await ServiceHelper.initializeCategoryService();
});

Given('I set the required headers', async () => {
  logger.logStep('Given', 'I set the required headers');
  logger.debug('Required headers are already set in API context');
});

When('I send a GET request to the category endpoint', async () => {
  logger.logStep('When', 'I send a GET request to the category endpoint');
  response = await categoryService.getCategories();
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.productCatalogManagement.category.list);
});

Then('the response should contain category data', async () => {
  logger.logStep('Then', 'the response should contain category data');
  await ResponseHelper.validateArrayResponse(response, 'Category');
});

Then('the response content type should be {string}', async (contentType: string) => {
  logger.logStep('Then', `the response content type should be "${contentType}"`);
  await ResponseHelper.validateContentType(response, contentType);
});
