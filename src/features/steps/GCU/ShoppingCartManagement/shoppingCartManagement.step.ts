import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../../utils/logger';
import { ResponseHelper } from '../../../../utils/responseHelper';
import { ServiceHelper } from '../../../../utils/serviceHelper';
import { ApiContext } from '../../../../core/api/apiContext';
import { ApiClient } from '../../../../core/api/apiClient';
import { ShoppingCartManagementService } from '../../../../services/shoppingCartManagementService';
import { requireResponseId } from '../../../../utils/strictHelpers';
import { expect } from '@playwright/test';
import { buildApiUrl } from '../../../../utils/apiUrl';
import { endpoints } from '../../../../config/shoppingCartManagement.endpoints';

const FEATURE = 'shoppingCartManagement';

let service: ShoppingCartManagementService;
let apiClient: ApiClient;
let response: any;
let createdShoppingCartId: string;

Given('I initialize the ' + FEATURE + ' service', async function () {
  logger.logStep('Given', 'I initialize the ' + FEATURE + ' service');
  const token = await ServiceHelper.getTokenFromAuthResponse();
  const authContext = await ApiContext.createWithAuth(token);
  apiClient = new ApiClient(authContext);
  service = new ShoppingCartManagementService(apiClient);
});

When('I send a POST request to create a shopping cart with valid payload for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create a shopping cart with valid payload for ' + FEATURE);
  const payload = { status: 'active' };
  const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.create);
  response = await service.create(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', url);
  const json = await response.json();
  createdShoppingCartId = requireResponseId(json.id, 'ShoppingCart');
});

When('I send a POST request to create a shopping cart with invalid payload for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create a shopping cart with invalid payload for ' + FEATURE);
  const payload = { status: 'invalidStatus' };
  const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.create);
  response = await service.create(payload as any);
  await ResponseHelper.logAndSetResponse(response, 'POST', url);
});

When('I send a GET request to list shopping carts for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to list shopping carts for ' + FEATURE);
  const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.list);
  response = await service.list();
  await ResponseHelper.logAndSetResponse(response, 'GET', url);
});

When('I send a GET request to retrieve a shopping cart by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve a shopping cart by id for ' + FEATURE);
  if (!createdShoppingCartId) throw new Error('No Shopping Cart ID stored from a prior create step');
  const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.retrieve(createdShoppingCartId));
  response = await service.retrieve(createdShoppingCartId);
  await ResponseHelper.logAndSetResponse(response, 'GET', url);
});

When('I send a PATCH request to update a shopping cart for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a PATCH request to update a shopping cart for ' + FEATURE);
  if (!createdShoppingCartId) throw new Error('No Shopping Cart ID stored from a prior create step');
  const payload = { statusReason: 'Updated by automation' };
  const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.update(createdShoppingCartId));
  response = await service.update(createdShoppingCartId, payload);
  await ResponseHelper.logAndSetResponse(response, 'PATCH', url);
});

When('I send a DELETE request to delete a shopping cart for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a DELETE request to delete a shopping cart for ' + FEATURE);
  if (!createdShoppingCartId) throw new Error('No Shopping Cart ID stored from a prior create step');
  const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.delete(createdShoppingCartId));
  response = await service.delete(createdShoppingCartId);
  await ResponseHelper.logAndSetResponse(response, 'DELETE', url);
});

When('I send a GET request to retrieve a non-existent shopping cart by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve a non-existent shopping cart by id for ' + FEATURE);
  const fakeId = 'NONEXISTENT';
  const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.retrieve(fakeId));
  response = await service.retrieve(fakeId);
  await ResponseHelper.logAndSetResponse(response, 'GET', url);
});