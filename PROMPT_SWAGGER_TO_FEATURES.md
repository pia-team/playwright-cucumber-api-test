# Prompt for Generating Cucumber Features and Step Definitions from Swagger JSON

Use the following prompt with an AI to generate feature files and step definitions from a Swagger JSON file that match this project's structure:

---

## PROMPT:

You are an API test automation expert. Analyze the provided Swagger JSON file and create Cucumber feature files and step definitions following the project structure below.

### Project Structure and Rules:

#### 1. File Structure:
- Feature files: `src/features/{feature-name}/{feature-name}.feature`
- Step definition files: `src/features/steps/{feature-name}/{feature-name}.step.ts`
- Service files: `src/services/{feature-name}Service.ts`
- Model files: `src/models/{feature-name}.model.ts`
- Endpoint management: `src/config/{featureName}.endpoints.ts` (one file per API, not a shared endpoints.ts)
- Keycloak token path only: `src/config/keycloak.endpoints.ts` (framework auth, do not edit per feature)

#### 2. Feature File Format:
```gherkin
@{tagName}
Feature: {API Name} API

  Scenario: {Scenario description}
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize {service-name} service with authorization token
    When I send a {METHOD} request to the {endpoint-name} endpoint
    Then the response status should be {status-code}
    And the response should contain {validation}
```

#### 3. Step Definition Format:
```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { logger } from '../../../utils/logger';
import { ServiceHelper } from '../../../utils/serviceHelper';
import { ResponseHelper } from '../../../utils/responseHelper';
import { {ServiceName}Service } from '../../../services/{serviceName}Service';
import { endpoints } from '../../../config/{featureName}.endpoints';

let {serviceName}Service: {ServiceName}Service;
let response: any;
let queryParams: { [key: string]: any } = {};

Given('I initialize {service-name} service with authorization token', async () => {
  logger.logStep('Given', 'I initialize {service-name} service with authorization token');
  {serviceName}Service = await ServiceHelper.initialize{ServiceName}Service();
});

When('I send a {METHOD} request to the {endpoint-name} endpoint', async () => {
  logger.logStep('When', 'I send a {METHOD} request to the {endpoint-name} endpoint');
  response = await {serviceName}Service.{methodName}({params});
  await ResponseHelper.logAndSetResponse(response, '{METHOD}', endpoints.{path}.{endpoint}, {params});
});

Then('the response status should be {int}', async (status: number) => {
  // This step is defined in common.step.ts, don't redefine here
});

Then('the response should contain {validation}', async () => {
  logger.logStep('Then', 'the response should contain {validation}');
  await ResponseHelper.validateArrayResponse(response, '{ItemName}');
});
```

#### 4. Service Class Format:
```typescript
import { ApiClient } from '../core/api/apiClient';
import { {ModelName} } from '../models/{modelName}.model';
import { endpoints } from '../config/{featureName}.endpoints';

export class {ServiceName}Service {
  constructor(private api: ApiClient) {}

  {methodName}({params}) {
    return this.api.{httpMethod}(endpoints.{path}.{endpoint}, {body}, {options});
  }
}
```

#### 5. Endpoint Management:
Each API gets its own `src/config/{featureName}.endpoints.ts` (full baseURI from Swagger servers + resource paths). Do NOT use or create `src/config/endpoints.ts`.
```typescript
export const endpoints = {
  {apiGroup}: {
    baseURI: 'https://host/api/{apiGroup}/v{version}',
    {resource}: {
      list: '/{resource}',
      create: '/{resource}',
      byId: (id: string) => `/{resource}/${id}`,
    }
  }
} as const;
```

#### 6. Use Util Classes:
- **ServiceHelper**: For service initialization
  - `initialize{ServiceName}Service(token?: string)`
  - `getTokenFromTestDataOrEnv()`
  - `getTokenFromAuthResponse()`

- **ResponseHelper**: For response handling
  - `logAndSetResponse(response, method, url, params?)`
  - `validateStatus(response, expectedStatus)`
  - `validateContentType(response, expectedType)`
  - `validateArrayResponse(response, itemName)`
  - `validateItemCount(response, maxCount)`
  - `getResponseBody(response)`

- **AuthHelper**: For authentication
  - `getConfiguredCredentials()` — uses credentials from the test-run UI (never hardcode usernames in features)
  - `getCredentialsForUser(username)` — legacy; prefer the configured test user step
  - `getToken(credentials)`
  - `getAccessToken()`

#### 7. Logger Usage:
Use logger in every step:
```typescript
logger.logStep('Given|When|Then', 'step description');
logger.logRequest(method, url, headers, body);
logger.logResponse(status, statusText, headers);
logger.info('message');
logger.debug('message');
logger.error('message', error);
```

#### 8. Query Parameters:
For query parameters:
```typescript
let queryParams: { [key: string]: string | number } = {};

When('I send a GET request with {string} parameter', async (param: string) => {
  queryParams = { paramName: param };
  response = await service.method(queryParams);
  await ResponseHelper.logAndSetResponse(response, 'GET', endpoint, queryParams);
});
```

#### 9. Request Body:
For POST/PUT requests:
```typescript
When('I send a POST request with body', async () => {
  const body = { /* test data */ };
  response = await service.create(body);
  await ResponseHelper.logAndSetResponse(response, 'POST', endpoint, body);
});
```

#### 10. Model Files:
Create TypeScript interface/model for each API resource:
```typescript
export interface {ModelName} {
  id?: string;
  // All fields from Swagger
}
```

### HTTP status codes (GCU/TMF — mandatory in features and steps)

This platform does **not** always match generic Swagger defaults. Use these in **every** generated feature:

| Operation | Expected status in `Then the response status should be {code}` |
|-----------|------------------------------------------------------------------|
| **GET list** or **GET by id** | **`Then the response status should be 200 or 206`** (accept either) |
| **POST create** success | **201** |
| **PATCH/PUT** update success | **200** or **204** (per Swagger) |
| **DELETE** success | **204** or **200** (per Swagger) |
| Validation / missing required field | **400** |

- For every GET list or GET retrieve scenario, assert with **`Then the response status should be 200 or 206`** (shared step in `common.step.ts`).
- PATCH service methods must send `Content-Type: application/merge-patch+json` (plain `application/json` on PATCH returns 400 on GCU).
- For POST bodies that reference another resource by `id`, create that parent in the step first and use the real `id` from the create response (never fake IDs).

### Tasks:

1. **Analyze Swagger JSON** and extract:
   - All endpoints (path, method, parameters, request body, responses)
   - Required authentication for each endpoint
   - Response schemas
   - Query parameters
   - Path parameters

2. **Group endpoints** (e.g., productCatalogManagement, userManagement, etc.)

3. **For each endpoint**, create:
   - Feature file (at least 2-3 scenarios: success, validation error, edge cases)
   - Step definition file
   - Service class
   - Model interface (if request/response body exists)
   - Add `src/config/{featureName}.endpoints.ts` for that API

4. **Scenarios should include**:
   - Authentication setup (always)
   - Service initialization
   - API call
   - Status validation
   - Response validation (data structure, content type, etc.)

5. **Use tags**:
   - Meaningful tags for each feature (@get{Resource}List, @create{Resource}, etc.)

### Example Output:

If Swagger has this endpoint:
```json
{
  "paths": {
    "/api/v1/products": {
      "get": {
        "summary": "Get products list",
        "parameters": [
          {"name": "limit", "in": "query", "type": "integer"},
          {"name": "sort", "in": "query", "type": "string"}
        ],
        "responses": {
          "206": {
            "description": "Partial Content (list)",
            "schema": {"type": "array", "items": {"$ref": "#/definitions/Product"}}
          }
        }
      }
    }
  }
}
```

Create:

1. `src/config/product.endpoints.ts` - Products API paths
2. `src/models/product.model.ts` - Product interface
3. `src/services/productService.ts` - ProductService class
4. `src/features/products/products.feature` - Feature file
5. `src/features/steps/products/products.step.ts` - Step definitions

### Important Notes:

- Step defs: import only `Given`, `When`, `Then` from `@cucumber/cucumber` — never `And()` or `But()`
- Strict TS: `requireResponseId()` from `src/utils/strictHelpers.ts` for ids; no raw `process.env` → `string`
- Services: `buildApiUrl(baseURI, path)` from `src/utils/apiUrl.ts` — never call API with path-only URL
- Step defs: **every** step pattern ends with ` for <featureName>` (e.g. `for partyManagement4`); use `const FEATURE = 'partyManagement4'` in step file; feature Gherkin must match
- Use logger in all steps
- Use util classes, avoid code duplication
- Use ResponseHelper methods for response validation
- Use ServiceHelper for service initialization
- Don't hardcode URLs; use the feature's `{featureName}.endpoints.ts` file
- Pay attention to TypeScript type safety
- Create at least 2-3 scenarios per endpoint (success, error, edge case)
- GET list/retrieve scenarios: **`Then the response status should be 200 or 206`**; create scenarios assert **201**

Now analyze the provided Swagger JSON file and create all files according to the rules above.

---

## Usage:

1. Prepare your Swagger JSON file
2. Paste the prompt above to an AI
3. Add your Swagger JSON
4. The AI will generate all files for you:
   - Feature files
   - Step definitions
   - Service classes
   - Model interfaces
   - Endpoint configurations

## Example Usage:

```
[Paste the prompt above]

Swagger JSON:
{
  "swagger": "2.0",
  "info": { ... },
  "paths": { ... },
  "definitions": { ... }
}
```
