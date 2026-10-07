import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../../utils/logger';
import { ResponseHelper } from '../../../../utils/responseHelper';
import { ServiceHelper } from '../../../../utils/serviceHelper';
import { ApiContext } from '../../../../core/api/apiContext';
import { ApiClient } from '../../../../core/api/apiClient';
import { DocumentApiService } from '../../../../services/document-apiService';
import { expect } from '@playwright/test';
import { requireResponseId } from '../../../../utils/strictHelpers';

const FEATURE = 'document-api';

let service: DocumentApiService;
let apiClient: ApiClient;
let response: any;
let createdDocumentId: string;
let createdAttachmentId: string;
let documentName: string;
let attachmentName: string;

Given('I initialize the ' + FEATURE + ' service', async () => {
  logger.logStep('Given', 'I initialize the ' + FEATURE + ' service');
  const token = await ServiceHelper.getTokenFromAuthResponse();
  const authContext = await ApiContext.createWithAuth(token);
  apiClient = new ApiClient(authContext);
  service = new DocumentApiService(apiClient);
});

When('I send a POST request to create a document for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a POST request to create a document for ' + FEATURE);
  documentName = `TestDocument-${Date.now()}`;
  const payload = {
    name: documentName,
    description: 'Test document description',
    documentType: 'pdf'
  };
  const url = service.getCreateDocumentUrl();
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', '/document');
  const json = await response.json();
  createdDocumentId = requireResponseId(json.id, 'document id');
});

When('I send a POST request to create a document with missing name for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a POST request to create a document with missing name for ' + FEATURE);
  const payload = {
    description: 'Test document without name'
  } as any;
  const url = service.getCreateDocumentUrl();
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', '/document');
});

When('I send a GET request to list documents for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to list documents for ' + FEATURE);
  const url = service.getListDocumentsUrl();
  response = await apiClient.get(url, { params: { limit: 10 } });
  await ResponseHelper.logAndSetResponse(response, 'GET', '/document');
});

When('I send a GET request to retrieve a document by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to retrieve a document by id for ' + FEATURE);
  const url = service.getDocumentByIdUrl(createdDocumentId);
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', `/document/${createdDocumentId}`);
});

When('I send a PATCH request to update a document for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a PATCH request to update a document for ' + FEATURE);
  const updatedName = `${documentName}-updated`;
  const payload = {
    name: updatedName,
    description: 'Updated document description'
  };
  const url = service.getDocumentByIdUrl(createdDocumentId);
  response = await apiClient.patch(url, payload, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  await ResponseHelper.logAndSetResponse(response, 'PATCH', `/document/${createdDocumentId}`);
  documentName = updatedName;
});

When('I send a DELETE request to delete a document for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a DELETE request to delete a document for ' + FEATURE);
  const url = service.getDocumentByIdUrl(createdDocumentId);
  response = await apiClient.delete(url);
  await ResponseHelper.logAndSetResponse(response, 'DELETE', `/document/${createdDocumentId}`);
});

When('I send a GET request to retrieve a non-existent document for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to retrieve a non-existent document for ' + FEATURE);
  const url = service.getDocumentByIdUrl('non-existent-id-12345');
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', '/document/non-existent-id-12345');
});

When('I send a POST request to create an attachment for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a POST request to create an attachment for ' + FEATURE);
  attachmentName = `TestAttachment-${Date.now()}`;
  const payload = {
    name: attachmentName,
    attachmentType: 'video',
    mimeType: 'mp4',
    url: 'https://example.com/attachment.mp4',
    description: 'Test attachment description'
  };
  const url = service.getCreateAttachmentUrl();
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', '/attachment');
  const json = await response.json();
  createdAttachmentId = requireResponseId(json.id, 'attachment id');
});

When('I send a POST request to create an attachment with missing required fields for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a POST request to create an attachment with missing required fields for ' + FEATURE);
  const payload = {
    name: 'Incomplete attachment'
  } as any;
  const url = service.getCreateAttachmentUrl();
  response = await apiClient.post(url, payload);
  await ResponseHelper.logAndSetResponse(response, 'POST', '/attachment');
});

When('I send a GET request to list attachments for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to list attachments for ' + FEATURE);
  const url = service.getListAttachmentsUrl();
  response = await apiClient.get(url, { params: { limit: 10 } });
  await ResponseHelper.logAndSetResponse(response, 'GET', '/attachment');
});

When('I send a GET request to retrieve an attachment by id for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to retrieve an attachment by id for ' + FEATURE);
  const url = service.getAttachmentByIdUrl(createdAttachmentId);
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', `/attachment/${createdAttachmentId}`);
});

When('I send a PATCH request to update an attachment for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a PATCH request to update an attachment for ' + FEATURE);
  const updatedName = `${attachmentName}-updated`;
  const payload = {
    name: updatedName,
    description: 'Updated attachment description'
  };
  const url = service.getAttachmentByIdUrl(createdAttachmentId);
  response = await apiClient.patch(url, payload, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  await ResponseHelper.logAndSetResponse(response, 'PATCH', `/attachment/${createdAttachmentId}`);
  attachmentName = updatedName;
});

When('I send a DELETE request to delete an attachment for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a DELETE request to delete an attachment for ' + FEATURE);
  const url = service.getAttachmentByIdUrl(createdAttachmentId);
  response = await apiClient.delete(url);
  await ResponseHelper.logAndSetResponse(response, 'DELETE', `/attachment/${createdAttachmentId}`);
});

When('I send a GET request to retrieve a non-existent attachment for ' + FEATURE, async () => {
  logger.logStep('When', 'I send a GET request to retrieve a non-existent attachment for ' + FEATURE);
  const url = service.getAttachmentByIdUrl('non-existent-id-67890');
  response = await apiClient.get(url);
  await ResponseHelper.logAndSetResponse(response, 'GET', '/attachment/non-existent-id-67890');
});

Given('I have a created document id for ' + FEATURE, async () => {
  logger.logStep('Given', 'I have a created document id for ' + FEATURE);
  if (!createdDocumentId) {
    documentName = `TestDocument-${Date.now()}`;
    const payload = {
      name: documentName,
      description: 'Test document for prerequisite',
      documentType: 'pdf'
    };
    const url = service.getCreateDocumentUrl();
    const createResponse = await apiClient.post(url, payload);
    await ResponseHelper.logAndSetResponse(createResponse, 'POST', '/document');
    const json = await createResponse.json();
    createdDocumentId = requireResponseId(json.id, 'document id');
  }
});

Given('I have a created attachment id for ' + FEATURE, async () => {
  logger.logStep('Given', 'I have a created attachment id for ' + FEATURE);
  if (!createdAttachmentId) {
    attachmentName = `TestAttachment-${Date.now()}`;
    const payload = {
      name: attachmentName,
      attachmentType: 'video',
      mimeType: 'mp4',
      url: 'https://example.com/attachment.mp4',
      description: 'Test attachment for prerequisite'
    };
    const url = service.getCreateAttachmentUrl();
    const createResponse = await apiClient.post(url, payload);
    await ResponseHelper.logAndSetResponse(createResponse, 'POST', '/attachment');
    const json = await createResponse.json();
    createdAttachmentId = requireResponseId(json.id, 'attachment id');
  }
});

Then('the response body should contain id for ' + FEATURE, async () => {
  logger.logStep('Then', 'the response body should contain id for ' + FEATURE);
  const json = await response.json();
  expect(json.id).toBeDefined();
  expect(typeof json.id).toBe('string');
});

Then('the response body should contain updated name for ' + FEATURE, async () => {
  logger.logStep('Then', 'the response body should contain updated name for ' + FEATURE);
  const json = await response.json();
  expect(json.name).toBeDefined();
  expect(json.name).toContain('updated');
});