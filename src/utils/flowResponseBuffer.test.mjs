import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  applyCaptureRules,
  clearFlowHttpBuffer,
  recordFlowHttpResponse,
} from './flowResponseBuffer.ts';

describe('flowResponseBuffer', () => {
  beforeEach(() => {
    clearFlowHttpBuffer();
  });

  it('captures from the matching method/url among multiple responses', () => {
    recordFlowHttpResponse({
      method: 'POST',
      url: 'https://api.example/orders',
      status: 201,
      body: { id: 'order-1' },
    });
    recordFlowHttpResponse({
      method: 'GET',
      url: 'https://api.example/customers/9',
      status: 200,
      body: { id: 'cust-9' },
    });

    const result = applyCaptureRules([
      {
        variableKey: 'orderId',
        required: true,
        sourceDefinition: {
          method: 'POST',
          urlPattern: '/orders',
          jsonPath: '$.id',
        },
      },
    ]);

    assert.equal(result.errors.length, 0);
    assert.equal(result.values.orderId, 'order-1');
  });

  it('fail-closed on ambiguous matches', () => {
    recordFlowHttpResponse({
      method: 'GET',
      url: 'https://api.example/a',
      status: 200,
      body: { id: '1' },
    });
    recordFlowHttpResponse({
      method: 'GET',
      url: 'https://api.example/b',
      status: 200,
      body: { id: '2' },
    });

    const result = applyCaptureRules([
      { variableKey: 'id', required: true, sourceDefinition: { jsonPath: '$.id' } },
    ]);

    assert.equal(Object.keys(result.values).length, 0);
    assert.ok(result.errors.some((e) => e.includes('Ambiguous')));
  });

  it('fail-closed when jsonPath missing', () => {
    recordFlowHttpResponse({
      method: 'POST',
      url: 'https://api.example/orders',
      status: 201,
      body: { name: 'x' },
    });

    const result = applyCaptureRules([
      {
        variableKey: 'orderId',
        required: true,
        sourceDefinition: { method: 'POST', urlPattern: '/orders', jsonPath: '$.id' },
      },
    ]);

    assert.ok(result.errors.some((e) => e.includes('JSONPath')));
  });
});
