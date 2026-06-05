import { ApiClient } from '../core/api/apiClient';
import { buildApiUrl } from '../utils/apiUrl';
import { endpoints } from '../config/shoppingCartManagement.endpoints';
import { ShoppingCartCreate, ShoppingCartUpdate } from '../models/shoppingCartManagement.model';

export class ShoppingCartManagementService {
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  async create(body: ShoppingCartCreate) {
    const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.create);
    return this.api.post(url, body);
  }

  async list(params?: Record<string, string | number>) {
    const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.list);
    return this.api.get(url, params ? { params } : undefined);
  }

  async retrieve(id: string, fields?: string) {
    const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.retrieve(id));
    return this.api.get(url, fields ? { params: { fields } } : undefined);
  }

  async update(id: string, body: ShoppingCartUpdate) {
    const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.update(id));
    return this.api.patch(url, body, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
    });
  }

  async delete(id: string) {
    const url = buildApiUrl(endpoints.shoppingCart.baseURI, endpoints.shoppingCart.delete(id));
    return this.api.delete(url);
  }
}