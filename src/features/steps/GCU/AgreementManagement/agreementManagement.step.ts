import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../../utils/logger';
import { ResponseHelper } from '../../../../utils/responseHelper';
import { ServiceHelper } from '../../../../utils/serviceHelper';
import { ApiContext } from '../../../../core/api/apiContext';
import { ApiClient } from '../../../../core/api/apiClient';
import { AgreementManagementService } from '../../../../services/agreementManagementService';
import { buildApiUrl } from '../../../../utils/apiUrl';
import { endpoints } from '../../../../config/agreementManagement.endpoints';
import { requireResponseId } from '../../../../utils/strictHelpers';

const FEATURE = 'agreementManagement';

let service: AgreementManagementService;
let apiClient: ApiClient;
let response: any;

let createdSpecId: string;
let createdAgreementId: string;
let createdPartyId: string;
let createdPartyName: string;

Given('I initialize the ' + FEATURE + ' service', async function () {
  logger.logStep('Given', 'I initialize the ' + FEATURE + ' service');
  const token = await ServiceHelper.getTokenFromAuthResponse();
  const authContext = await ApiContext.createWithAuth(token);
  apiClient = new ApiClient(authContext);
  service = new AgreementManagementService(apiClient);
});

// Agreement Specification steps
Given('I have created an agreement specification for ' + FEATURE, async function () {
  logger.logStep('Given', 'I have created an agreement specification for ' + FEATURE);
  const payload = {
    name: `Spec-${Date.now()}`,
    attachment: [
      {
        id: `attach-${Date.now()}`,
        name: 'test document',
        attachmentType: 'document',
        url: 'http://example.com/doc.pdf'
      }
    ]
  };
  response = await service.createAgreementSpecification(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list));
  const body = await response.json();
  createdSpecId = requireResponseId(body.id, 'agreementSpecification');
});

When('I send a POST request to create an agreement specification with valid payload for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement specification with valid payload for ' + FEATURE);
  const payload = {
    name: `Spec-${Date.now()}`,
    attachment: [
      {
        id: `attach-${Date.now()}`,
        name: 'test document',
        attachmentType: 'document',
        url: 'http://example.com/doc.pdf'
      }
    ]
  };
  response = await service.createAgreementSpecification(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list));
});

When('I send a POST request to create an agreement specification with missing attachment for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement specification with missing attachment for ' + FEATURE);
  const payload = { name: `Spec-${Date.now()}` } as any;
  response = await service.createAgreementSpecification(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list));
});

When('I send a POST request to create an agreement specification with missing name for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement specification with missing name for ' + FEATURE);
  const payload = {
    attachment: [
      { id: 'attach-1', name: 'test', attachmentType: 'document', url: 'http://example.com' }
    ]
  } as any;
  response = await service.createAgreementSpecification(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list));
});

When('I send a GET request to list agreement specifications for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to list agreement specifications for ' + FEATURE);
  response = await service.getAgreementSpecifications();
  await ResponseHelper.logAndSetResponse(response, 'GET', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list));
});

When('I send a GET request to retrieve the agreement specification by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve the agreement specification by id for ' + FEATURE);
  response = await service.getAgreementSpecification(createdSpecId);
  await ResponseHelper.logAndSetResponse(response, 'GET', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.byId(createdSpecId)));
});

When('I send a PATCH request to update the agreement specification for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a PATCH request to update the agreement specification for ' + FEATURE);
  const updatePayload = { description: 'Updated description ' + Date.now() };
  response = await service.patchAgreementSpecification(createdSpecId, updatePayload);
  await ResponseHelper.logAndSetResponse(response, 'PATCH', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.byId(createdSpecId)));
});

When('I send a DELETE request to delete the agreement specification by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a DELETE request to delete the agreement specification by id for ' + FEATURE);
  response = await service.deleteAgreementSpecification(createdSpecId);
  await ResponseHelper.logAndSetResponse(response, 'DELETE', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.byId(createdSpecId)));
});

When('I send a GET request to retrieve a non-existent agreement specification by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve a non-existent agreement specification by id for ' + FEATURE);
  const fakeId = 'nonexistent-spec-999999';
  response = await service.getAgreementSpecification(fakeId);
  await ResponseHelper.logAndSetResponse(response, 'GET', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.byId(fakeId)));
});

// Prerequisite steps for Agreement
Given('I have a valid agreement specification and an individual party for ' + FEATURE, async function () {
  logger.logStep('Given', 'I have a valid agreement specification and an individual party for ' + FEATURE);

  // Create agreement specification
  const specPayload = {
    name: `Spec-${Date.now()}`,
    attachment: [{ id: `att-${Date.now()}`, name: 'doc', attachmentType: 'document', url: 'http://example.com' }]
  };
  response = await service.createAgreementSpecification(specPayload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list));
  let body = await response.json();
  createdSpecId = requireResponseId(body.id, 'agreementSpecification');

  // Create individual party
  const individualUrl = 'https://dpam-api.pi.dev-gcu.com/api/partyManagement/v4/individual';
  const givenName = 'Given' + Date.now();
  const familyName = 'Tester';
  const individualPayload = { givenName, familyName };
  const partyResp = await apiClient.post(individualUrl, individualPayload);
  await ResponseHelper.logAndSetResponse(partyResp, 'POST', individualUrl);
  const partyBody = await partyResp.json();
  createdPartyId = requireResponseId(partyBody.id, 'individual');
  createdPartyName = `${partyBody.givenName} ${partyBody.familyName}`;
});

Given('I have created an agreement for ' + FEATURE, async function () {
  logger.logStep('Given', 'I have created an agreement for ' + FEATURE);

  // Create agreement specification
  const specPayload = {
    name: `Spec-${Date.now()}`,
    attachment: [{ id: `att-${Date.now()}`, name: 'doc', attachmentType: 'document', url: 'http://example.com' }]
  };
  response = await service.createAgreementSpecification(specPayload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreementSpecification.baseURI, endpoints.agreementSpecification.list));
  let body = await response.json();
  const specId = requireResponseId(body.id, 'agreementSpecification');

  // Create individual party
  const individualUrl = 'https://dpam-api.pi.dev-gcu.com/api/partyManagement/v4/individual';
  const givenName = 'Given' + Date.now();
  const familyName = 'Tester';
  const individualPayload = { givenName, familyName };
  const partyResp = await apiClient.post(individualUrl, individualPayload);
  await ResponseHelper.logAndSetResponse(partyResp, 'POST', individualUrl);
  const partyBody = await partyResp.json();
  const partyId = requireResponseId(partyBody.id, 'individual');
  const partyName = `${partyBody.givenName} ${partyBody.familyName}`;

  // Create agreement
  const agreementPayload = {
    agreementItem: [{ id: `item-${Date.now()}` }],
    agreementType: 'TestType',
    engagedParty: [{ id: partyId, name: partyName, '@referredType': 'Individual' }],
    name: `Agreement ${Date.now()}`,
    agreementSpecification: { id: specId, href: `${endpoints.agreementSpecification.baseURI}/agreementSpecification/${specId}` }
  };
  response = await service.createAgreement(agreementPayload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list));
  body = await response.json();
  createdAgreementId = requireResponseId(body.id, 'agreement');
});

// Agreement steps
When('I send a POST request to create an agreement with valid payload for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement with valid payload for ' + FEATURE);
  const href = `${endpoints.agreementSpecification.baseURI}/agreementSpecification/${createdSpecId}`;
  const payload = {
    agreementItem: [{ id: `item-${Date.now()}` }],
    agreementType: 'TestType',
    engagedParty: [{ id: createdPartyId, name: createdPartyName, '@referredType': 'Individual' }],
    name: `Agreement ${Date.now()}`,
    agreementSpecification: { id: createdSpecId, href }
  };
  response = await service.createAgreement(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list));
  const body = await response.json();
  createdAgreementId = requireResponseId(body.id, 'agreement');
});

When('I send a POST request to create an agreement with missing agreementItem for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement with missing agreementItem for ' + FEATURE);
  const href = `${endpoints.agreementSpecification.baseURI}/agreementSpecification/${createdSpecId}`;
  const payload = {
    agreementType: 'TestType',
    engagedParty: [{ id: createdPartyId, name: createdPartyName, '@referredType': 'Individual' }],
    name: `Agreement ${Date.now()}`,
    agreementSpecification: { id: createdSpecId, href }
  } as any;
  response = await service.createAgreement(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list));
});

When('I send a POST request to create an agreement with missing agreementType for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement with missing agreementType for ' + FEATURE);
  const href = `${endpoints.agreementSpecification.baseURI}/agreementSpecification/${createdSpecId}`;
  const payload = {
    agreementItem: [{ id: `item-${Date.now()}` }],
    engagedParty: [{ id: createdPartyId, name: createdPartyName, '@referredType': 'Individual' }],
    name: `Agreement ${Date.now()}`,
    agreementSpecification: { id: createdSpecId, href }
  } as any;
  response = await service.createAgreement(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list));
});

When('I send a POST request to create an agreement with missing engagedParty for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement with missing engagedParty for ' + FEATURE);
  const href = `${endpoints.agreementSpecification.baseURI}/agreementSpecification/${createdSpecId}`;
  const payload = {
    agreementItem: [{ id: `item-${Date.now()}` }],
    agreementType: 'TestType',
    name: `Agreement ${Date.now()}`,
    agreementSpecification: { id: createdSpecId, href }
  } as any;
  response = await service.createAgreement(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list));
});

When('I send a POST request to create an agreement with missing name for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a POST request to create an agreement with missing name for ' + FEATURE);
  const href = `${endpoints.agreementSpecification.baseURI}/agreementSpecification/${createdSpecId}`;
  const payload = {
    agreementItem: [{ id: `item-${Date.now()}` }],
    agreementType: 'TestType',
    engagedParty: [{ id: createdPartyId, name: createdPartyName, '@referredType': 'Individual' }],
    agreementSpecification: { id: createdSpecId, href }
  } as any;
  response = await service.createAgreement(payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list));
});

When('I send a GET request to list agreements for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to list agreements for ' + FEATURE);
  response = await service.getAgreements();
  await ResponseHelper.logAndSetResponse(response, 'GET', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.list));
});

When('I send a GET request to retrieve the agreement by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve the agreement by id for ' + FEATURE);
  response = await service.getAgreement(createdAgreementId);
  await ResponseHelper.logAndSetResponse(response, 'GET', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.byId(createdAgreementId)));
});

When('I send a PATCH request to update the agreement for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a PATCH request to update the agreement for ' + FEATURE);
  const updatePayload = { description: 'Updated description ' + Date.now() };
  response = await service.patchAgreement(createdAgreementId, updatePayload);
  await ResponseHelper.logAndSetResponse(response, 'PATCH', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.byId(createdAgreementId)));
});

When('I send a DELETE request to delete the agreement by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a DELETE request to delete the agreement by id for ' + FEATURE);
  response = await service.deleteAgreement(createdAgreementId);
  await ResponseHelper.logAndSetResponse(response, 'DELETE', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.byId(createdAgreementId)));
});

When('I send a GET request to retrieve a non-existent agreement by id for ' + FEATURE, async function () {
  logger.logStep('When', 'I send a GET request to retrieve a non-existent agreement by id for ' + FEATURE);
  const fakeId = 'nonexistent-agreement-999999';
  response = await service.getAgreement(fakeId);
  await ResponseHelper.logAndSetResponse(response, 'GET', buildApiUrl(endpoints.agreement.baseURI, endpoints.agreement.byId(fakeId)));
});