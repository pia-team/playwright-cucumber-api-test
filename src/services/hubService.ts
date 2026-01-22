import { ApiClient } from '../core/api/apiClient';
import { endpoints } from '../config/endpoints';
import { EventSubscriptionInput } from '../models/hub.model';

export class HubService {
  constructor(private api: ApiClient) {}

  async listListeners(queryParams?: { [key: string]: any }) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.hub.list}`;
    return this.api.get(url, { params: queryParams });
  }

  async registerListener(body: EventSubscriptionInput) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.hub.register}`;
    return this.api.post(url, body);
  }

  async unregisterListener(id: string) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.hub.unregister(id)}`;
    return this.api.delete(url);
  }
}