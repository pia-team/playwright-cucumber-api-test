import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import { logger } from '../../../../utils/logger';
import { ResponseHelper } from '../../../../utils/responseHelper';
import { ServiceHelper } from '../../../../utils/serviceHelper';
import { ApiContext } from '../../../../core/api/apiContext';
import { ApiClient } from '../../../../core/api/apiClient';
import { ResourceInventoryService } from '../../../../services/resource_inventoryService';
import { buildApiUrl } from '../../../../utils/apiUrl';
import { endpoints } from '../../../../config/resource_inventory.endpoints';
import { requireResponseId } from '../../../../utils/strictHelpers';
import { expect } from '@playwright/test';

/** Orange inventory list can be slow; default Cucumber 5s is too short. */
setDefaultTimeout(60_000);

const FEATURE = 'resource_inventory';

let service: ResourceInventoryService;
let apiClient: ApiClient;
let response: any;
let createdIds: Record<string, string> = {};

const endpointKeys: Record<string, string> = {
  'Bulk Resource Create': 'bulkResourceCreate',
  'Bulk Resource Status Update': 'bulkResourceStatusUpdate',
  Resource: 'resource',
};

/** Build a compact numeric MSISDN-like range for bulk characteristic counters. */
function buildPhoneRange(itemCount: number): {
  valueFrom: string;
  valueTo: string;
  valueMask: string;
  sampleValue: string;
} {
  const start = 905550000000 + (Date.now() % 900000);
  const valueFrom = String(start);
  const valueTo = String(start + itemCount - 1);
  return {
    valueFrom,
    valueTo,
    valueMask: 'X'.repeat(valueFrom.length),
    sampleValue: valueFrom,
  };
}

function relatedPartyFixture() {
  return [
    {
      '@type': 'RelatedParty',
      id: 'customer-001',
      name: 'Customer 001',
      role: 'customer',
      '@referredType': 'Customer',
    },
  ];
}

function aclRelatedPartyFixture() {
  return [
    {
      '@type': 'RelatedParty',
      id: 'admin',
      name: 'admin',
      role: 'owner',
      '@referredType': 'IAMUser',
    },
  ];
}

function telephoneCharacteristic(value: string) {
  return [
    {
      '@type': 'Characteristic',
      name: 'telephoneNumber',
      value,
    },
  ];
}

function bulkTelephoneCharacteristic(itemCount: number) {
  const range = buildPhoneRange(itemCount);
  return {
    '@type': 'BulkCharacteristic',
    name: 'telephoneNumber',
    valueFrom: range.valueFrom,
    valueTo: range.valueTo,
    valueMask: range.valueMask,
    counterType: 'DECIMAL',
  };
}

const getDefaultPayload = (resourceLabel: string): any => {
  const timestamp = Date.now();
  switch (resourceLabel) {
    case 'Bulk Resource Create': {
      const itemCount = 5;
      const range = buildPhoneRange(itemCount);
      const bulkChar = bulkTelephoneCharacteristic(itemCount);
      return {
        '@type': 'BulkResourceCreate',
        jobReference: `job-${timestamp}`,
        itemCount,
        baseResource: {
          '@type': 'LogicalResource',
          '@baseType': 'Resource',
          name: `logical-msisdn-${timestamp}`,
          resourceStatus: 'available',
          value: range.sampleValue,
          relatedParty: relatedPartyFixture(),
          aclRelatedParty: aclRelatedPartyFixture(),
          resourceCharacteristic: telephoneCharacteristic(range.sampleValue),
        },
        bulkCharacteristic: [bulkChar],
      };
    }
    case 'Bulk Resource Status Update': {
      const itemCount = 3;
      return {
        '@type': 'BulkResourceStatusUpdate',
        itemCount,
        resourceStatus: 'available',
        jobReference: `update-job-${timestamp}`,
        bulkCharacteristic: bulkTelephoneCharacteristic(itemCount),
      };
    }
    case 'Resource': {
      const range = buildPhoneRange(1);
      return {
        '@type': 'LogicalResource',
        '@baseType': 'Resource',
        name: `logical-msisdn-${timestamp}`,
        description: `Test resource ${timestamp}`,
        resourceStatus: 'available',
        value: range.sampleValue,
        relatedParty: relatedPartyFixture(),
        aclRelatedParty: aclRelatedPartyFixture(),
        resourceCharacteristic: telephoneCharacteristic(range.sampleValue),
      };
    }
    default:
      return {};
  }
};

async function assertOkOrKeepResponse(label: string, res: any): Promise<any> {
  if (!res.ok()) {
    logger.error(`${label} failed: HTTP ${res.status()}`);
  }
  return res;
}

const createMethods: Record<string, (payload: any) => Promise<any>> = {
  bulkResourceCreate: async (payload: any) => {
    const url = buildApiUrl(endpoints.bulkResourceCreate.baseURI, endpoints.bulkResourceCreate.create);
    response = await service.createBulkResourceCreate(payload);
    await ResponseHelper.logAndSetResponse(response, 'POST', url);
    await assertOkOrKeepResponse('BulkResourceCreate', response);
    return response;
  },
  bulkResourceStatusUpdate: async (payload: any) => {
    const url = buildApiUrl(
      endpoints.bulkResourceStatusUpdate.baseURI,
      endpoints.bulkResourceStatusUpdate.create,
    );
    response = await service.createBulkResourceStatusUpdate(payload);
    await ResponseHelper.logAndSetResponse(response, 'POST', url);
    await assertOkOrKeepResponse('BulkResourceStatusUpdate', response);
    return response;
  },
  resource: async (payload: any) => {
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.create);
    response = await service.createResource(payload);
    await ResponseHelper.logAndSetResponse(response, 'POST', url);
    // Capture id only on success so negative (400) scenarios still reach Then assertions.
    if (response.ok()) {
      const json = await response.json();
      createdIds.Resource = requireResponseId(json.id, 'Resource id');
    }
    return response;
  },
};

const listMethods: Record<string, () => Promise<any>> = {
  resource: async () => {
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.list);
    response = await service.listResources({ limit: 20, offset: 0 });
    await ResponseHelper.logAndSetResponse(response, 'GET', url);
    return response;
  },
};

const getByIdMethods: Record<string, () => Promise<any>> = {
  resource: async () => {
    const id = createdIds.Resource;
    if (!id) {
      throw new Error('Resource id is required before getById — create step must succeed first');
    }
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.byId(id));
    response = await service.getResourceById(id);
    await ResponseHelper.logAndSetResponse(response, 'GET', url);
    return response;
  },
};

const patchMethods: Record<string, () => Promise<any>> = {
  resource: async () => {
    const id = createdIds.Resource;
    if (!id) {
      throw new Error('Resource id is required before patch — create step must succeed first');
    }
    const timestamp = Date.now();
    const payload = {
      name: `Updated-Resource-${timestamp}`,
      statusReason: `Updated at ${timestamp}`,
    };
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.byId(id));
    response = await service.updateResource(id, payload);
    await ResponseHelper.logAndSetResponse(response, 'PATCH', url);
    return response;
  },
};

const deleteMethods: Record<string, () => Promise<any>> = {
  resource: async () => {
    const id = createdIds.Resource;
    if (!id) {
      throw new Error('Resource id is required before delete — create step must succeed first');
    }
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.byId(id));
    response = await service.deleteResource(id);
    await ResponseHelper.logAndSetResponse(response, 'DELETE', url);
    return response;
  },
};

Given('I initialize the ' + FEATURE + ' service', async () => {
  logger.logStep('Given', 'I initialize the ' + FEATURE + ' service');
  createdIds = {};
  const token = await ServiceHelper.getTokenFromAuthResponse();
  const authContext = await ApiContext.createWithAuth(token);
  apiClient = new ApiClient(authContext);
  service = new ResourceInventoryService(apiClient);
});

// Negative-lookahead so "… missing required field …" only matches the dedicated step.
When(
  new RegExp(
    '^I send a POST request to create an? (?!.*missing required field)(.+) for ' + FEATURE + '$',
  ),
  async (resourceLabel: string) => {
    logger.logStep('When', `I send a POST request to create an ${resourceLabel} for ${FEATURE}`);
    const endpointKey = endpointKeys[resourceLabel];
    if (!endpointKey) {
      throw new Error(`Unknown resource label: ${resourceLabel}`);
    }
    const payload = getDefaultPayload(resourceLabel);
    await createMethods[endpointKey](payload);
  },
);

When(
  new RegExp(
    '^I send a POST request to create an? (.+) missing required field (\\S+) for ' + FEATURE + '$',
  ),
  async (resourceLabel: string, fieldName: string) => {
    logger.logStep(
      'When',
      `I send a POST request to create an ${resourceLabel} missing required field ${fieldName} for ${FEATURE}`,
    );
    const endpointKey = endpointKeys[resourceLabel];
    if (!endpointKey) {
      throw new Error(`Unknown resource label: ${resourceLabel}`);
    }
    const payload = getDefaultPayload(resourceLabel);
    delete (payload as any)[fieldName];
    await createMethods[endpointKey](payload as any);
  },
);

When(new RegExp('^I send a GET request to list (.+) for ' + FEATURE + '$'), async (resourceLabel: string) => {
  logger.logStep('When', `I send a GET request to list ${resourceLabel} for ${FEATURE}`);
  const endpointKey = endpointKeys[resourceLabel];
  if (!endpointKey || !listMethods[endpointKey]) {
    throw new Error(`No list method for resource: ${resourceLabel}`);
  }
  await listMethods[endpointKey]();
});

When(
  new RegExp('^I send a GET request to retrieve an? (.+) by id for ' + FEATURE + '$'),
  async (resourceLabel: string) => {
    logger.logStep('When', `I send a GET request to retrieve an ${resourceLabel} by id for ${FEATURE}`);
    const endpointKey = endpointKeys[resourceLabel];
    if (!endpointKey || !getByIdMethods[endpointKey]) {
      throw new Error(`No getById method for resource: ${resourceLabel}`);
    }
    await getByIdMethods[endpointKey]();
  },
);

When(
  new RegExp('^I send a GET request to retrieve non-existent (.+) by id for ' + FEATURE + '$'),
  async (resourceLabel: string) => {
    logger.logStep(
      'When',
      `I send a GET request to retrieve non-existent ${resourceLabel} by id for ${FEATURE}`,
    );
    const endpointKey = endpointKeys[resourceLabel];
    if (!endpointKey || !getByIdMethods[endpointKey]) {
      throw new Error(`No getById method for resource: ${resourceLabel}`);
    }
    createdIds[resourceLabel] = 'non-existent-id-12345';
    await getByIdMethods[endpointKey]();
  },
);

When(
  new RegExp('^I send a PATCH request to update an? (.+) for ' + FEATURE + '$'),
  async (resourceLabel: string) => {
    logger.logStep('When', `I send a PATCH request to update an ${resourceLabel} for ${FEATURE}`);
    const endpointKey = endpointKeys[resourceLabel];
    if (!endpointKey || !patchMethods[endpointKey]) {
      throw new Error(`No patch method for resource: ${resourceLabel}`);
    }
    await patchMethods[endpointKey]();
  },
);

When(
  new RegExp('^I send a DELETE request to delete an? (.+) for ' + FEATURE + '$'),
  async (resourceLabel: string) => {
    logger.logStep('When', `I send a DELETE request to delete an ${resourceLabel} for ${FEATURE}`);
    const endpointKey = endpointKeys[resourceLabel];
    if (!endpointKey || !deleteMethods[endpointKey]) {
      throw new Error(`No delete method for resource: ${resourceLabel}`);
    }
    await deleteMethods[endpointKey]();
  },
);

Then('the response body should contain an error message for ' + FEATURE, async () => {
  logger.logStep('Then', 'the response body should contain an error message for ' + FEATURE);
  const json = await response.json();
  expect(json.message || json.reason || json.code || json.error).toBeDefined();
});
