import { ApiClient } from '../core/api/apiClient';
import { buildApiUrl } from '../utils/apiUrl';
import { endpoints } from '../config/resource_inventory.endpoints';

export class ResourceInventoryService {
  private api: ApiClient;

  constructor(apiClient: ApiClient) {
    this.api = apiClient;
  }

  async createBulkResourceCreate(body: any) {
    const url = buildApiUrl(endpoints.bulkResourceCreate.baseURI, endpoints.bulkResourceCreate.create);
    return this.api.post(url, body);
  }

  async createBulkResourceStatusUpdate(body: any) {
    const url = buildApiUrl(endpoints.bulkResourceStatusUpdate.baseURI, endpoints.bulkResourceStatusUpdate.create);
    return this.api.post(url, body);
  }

  async createResource(body: any) {
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.create);
    return this.api.post(url, body);
  }

  async listResources(params?: Record<string, string | number>) {
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.list);
    return this.api.get(url, params ? { params } : undefined);
  }

  async getResourceById(id: string) {
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.byId(id));
    return this.api.get(url);
  }

  async updateResource(id: string, body: any) {
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.byId(id));
    return this.api.patch(url, body, { headers: { 'Content-Type': 'application/merge-patch+json' } });
  }

  async deleteResource(id: string) {
    const url = buildApiUrl(endpoints.resource.baseURI, endpoints.resource.byId(id));
    return this.api.delete(url);
  }
}