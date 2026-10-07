import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../../utils/logger';
import { ResponseHelper } from '../../../../utils/responseHelper';
import { ServiceHelper } from '../../../../utils/serviceHelper';
import { ApiContext } from '../../../../core/api/apiContext';
import { ApiClient } from '../../../../core/api/apiClient';
import { PartyRoleService } from '../../../../services/party_roleService';
import { buildApiUrl } from '../../../../utils/apiUrl';
import { endpoints } from '../../../../config/party_role.endpoints';
import { expect } from '@playwright/test';
import { requireResponseId } from '../../../../utils/strictHelpers';

const FEATURE = 'party_role';

let service: PartyRoleService;
let apiClient: ApiClient;
let response: any;
let createdRoleTypeId: string;
let createdPartyRoleId: string;
let roleTypeName: string;
let partyRoleName: string;

async function createRoleTypeFixture(): Promise<string> {
  const roleTypeNameCreate = `RoleType_${Date.now()}`;
  const roleTypePayload = {
    name: roleTypeNameCreate,
    description: 'Role type for party role test',
  };
  const roleTypeUrl = buildApiUrl(endpoints.baseURI, endpoints.roleType.create);
  const roleTypeResponse = await apiClient.post(roleTypeUrl, roleTypePayload);
  await ResponseHelper.logAndSetResponse(roleTypeResponse, 'POST', endpoints.roleType.create);
  if (!roleTypeResponse.ok()) {
    throw new Error(
      `Failed to create roleType fixture: HTTP ${roleTypeResponse.status()}`,
    );
  }
  const roleTypeJson = await roleTypeResponse.json();
  return requireResponseId(roleTypeJson.id, 'roleTypeId for party role');
}

/**
 * Party Role engagedParty references an Individual from Party Management (separate API).
 * Previous generate used partyRoleManagement/.../individual which does not exist.
 */
async function createIndividualFixture(): Promise<string> {
  const partyUrl = buildApiUrl(
    endpoints.partyManagementBaseURI,
    endpoints.individual.create,
  );
  const partyPayload = {
    familyName: `Family_${Date.now()}`,
    givenName: `Given_${Date.now()}`,
  };
  const partyResponse = await apiClient.post(partyUrl, partyPayload);
  await ResponseHelper.logAndSetResponse(partyResponse, 'POST', partyUrl);
  if (!partyResponse.ok()) {
    const body = await partyResponse.text().catch(() => '');
    throw new Error(
      `Failed to create Individual fixture for engagedParty: HTTP ${partyResponse.status()} url=${partyUrl} body=${body}`,
    );
  }
  const partyJson = await partyResponse.json();
  return requireResponseId(partyJson.id, 'partyId for engagedParty');
}

Given('I initialize the ' + FEATURE + ' service', async () => {
  logger.logStep('Given', 'I initialize the ' + FEATURE + ' service');
  const token = await ServiceHelper.getTokenFromAuthResponse();
  const authContext = await ApiContext.createWithAuth(token);
  apiClient = new ApiClient(authContext);
  service = new PartyRoleService(apiClient);
});

When('I create a role type with valid payload for ' + FEATURE, async () => {
  logger.logStep('When', 'I create a role type with valid payload for ' + FEATURE);
  roleTypeName = `RoleType_${Date.now()}`;
  const payload = {
    name: roleTypeName,
    description: 'Test role type'
  };
  const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.create);
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', endpoints.roleType.create);
  const json = await response.json();
  createdRoleTypeId = requireResponseId(json.id, 'roleTypeId');
});

When('I create a role type missing name for ' + FEATURE, async () => {
  logger.logStep('When', 'I create a role type missing name for ' + FEATURE);
  const payload = {
    description: 'Test role type without name'
  } as any;
  const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.create);
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', endpoints.roleType.create);
});

When('I send a GET request to list role types for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to list role types for ' + FEATURE);
  const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.list);
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.roleType.list);
});

When('I retrieve a role type by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I retrieve a role type by id for ' + FEATURE);
  const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.byId(createdRoleTypeId));
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.roleType.byId(createdRoleTypeId));
});

When('I update a role type by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I update a role type by id for ' + FEATURE);
  const updatedName = `${roleTypeName}_updated`;
  const payload = {
    name: updatedName,
    description: 'Updated role type'
  };
  const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.byId(createdRoleTypeId));
  response = await apiClient.patch(url, payload, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  await ResponseHelper.logAndSetResponse(response, 'PATCH', endpoints.roleType.byId(createdRoleTypeId));
  roleTypeName = updatedName;
});

When('I delete a role type by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I delete a role type by id for ' + FEATURE);
  const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.byId(createdRoleTypeId));
  response = await apiClient.delete(url);
  await ResponseHelper.logAndSetResponse(response, 'DELETE', endpoints.roleType.byId(createdRoleTypeId));
});

When('I retrieve a non-existent role type by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I retrieve a non-existent role type by id for ' + FEATURE);
  const fakeId = 'non-existent-id-12345';
  const url = buildApiUrl(endpoints.baseURI, endpoints.roleType.byId(fakeId));
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.roleType.byId(fakeId));
});

When('I create a party role with valid payload for ' + FEATURE, async () => {
  logger.logStep('When', 'I create a party role with valid payload for ' + FEATURE);
  const roleTypeId = await createRoleTypeFixture();
  const partyId = await createIndividualFixture();

  partyRoleName = `PartyRole_${Date.now()}`;
  const payload = {
    name: partyRoleName,
    engagedParty: {
      id: partyId,
      '@referredType': 'Individual'
    },
    roleType: {
      id: roleTypeId
    }
  };
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.create);
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', endpoints.partyRole.create);
  const json = await response.json();
  createdPartyRoleId = requireResponseId(json.id, 'partyRoleId');
});

When('I create a party role missing engagedParty for ' + FEATURE, async () => {
  logger.logStep('When', 'I create a party role missing engagedParty for ' + FEATURE);
  const roleTypeId = await createRoleTypeFixture();

  const payload = {
    name: `PartyRole_${Date.now()}`,
    roleType: {
      id: roleTypeId
    }
  } as any;
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.create);
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', endpoints.partyRole.create);
});

When('I create a party role missing name for ' + FEATURE, async () => {
  logger.logStep('When', 'I create a party role missing name for ' + FEATURE);
  const roleTypeId = await createRoleTypeFixture();
  const partyId = await createIndividualFixture();

  const payload = {
    engagedParty: {
      id: partyId,
      '@referredType': 'Individual'
    },
    roleType: {
      id: roleTypeId
    }
  } as any;
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.create);
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', endpoints.partyRole.create);
});

When('I create a party role missing roleType for ' + FEATURE, async () => {
  logger.logStep('When', 'I create a party role missing roleType for ' + FEATURE);
  const partyId = await createIndividualFixture();

  const payload = {
    name: `PartyRole_${Date.now()}`,
    engagedParty: {
      id: partyId,
      '@referredType': 'Individual'
    }
  } as any;
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.create);
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', endpoints.partyRole.create);
});

When('I send a GET request to list party roles for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to list party roles for ' + FEATURE);
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.list);
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.partyRole.list);
});

When('I retrieve a party role by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I retrieve a party role by id for ' + FEATURE);
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.byId(createdPartyRoleId));
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.partyRole.byId(createdPartyRoleId));
});

When('I update a party role by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I update a party role by id for ' + FEATURE);
  const updatedName = `${partyRoleName}_updated`;
  const payload = {
    name: updatedName,
    statusReason: 'Updated status reason'
  };
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.byId(createdPartyRoleId));
  response = await apiClient.patch(url, payload, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  await ResponseHelper.logAndSetResponse(response, 'PATCH', endpoints.partyRole.byId(createdPartyRoleId));
  partyRoleName = updatedName;
});

When('I delete a party role by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I delete a party role by id for ' + FEATURE);
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.byId(createdPartyRoleId));
  response = await apiClient.delete(url);
  await ResponseHelper.logAndSetResponse(response, 'DELETE', endpoints.partyRole.byId(createdPartyRoleId));
});

When('I retrieve a non-existent party role by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I retrieve a non-existent party role by id for ' + FEATURE);
  const fakeId = 'non-existent-party-role-12345';
  const url = buildApiUrl(endpoints.baseURI, endpoints.partyRole.byId(fakeId));
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoints.partyRole.byId(fakeId));
});

Then('the response body should contain id for ' + FEATURE, async () => {
  logger.logStep('Then', 'the response body should contain id for ' + FEATURE);
  const json = await response.json();
  expect(json.id).toBeDefined();
  expect(typeof json.id).toBe('string');
});
