import { ApiClient } from '../core/api/apiClient';
import { buildApiUrl } from '../utils/apiUrl';
import { endpoints } from '../config/quoteManagement.endpoints';
import { QuoteCreate, QuoteUpdate } from '../models/quoteManagement.model';

export class QuoteManagementService {
  private api: ApiClient;

  constructor(apiClient: ApiClient) {
    this.api = apiClient;
  }

  async createQuote(body: QuoteCreate) {
    const url = buildApiUrl(endpoints.quote.baseURI, endpoints.quote.create);
    return this.api.post(url, body);
  }

  async listQuotes(params?: Record<string, string | number>) {
    const url = buildApiUrl(endpoints.quote.baseURI, endpoints.quote.list);
    return this.api.get(url, params ? { params } : undefined);
  }

  async retrieveQuote(id: string) {
    const url = buildApiUrl(endpoints.quote.baseURI, endpoints.quote.byId(id));
    return this.api.get(url);
  }

  async updateQuote(id: string, body: QuoteUpdate) {
    const url = buildApiUrl(endpoints.quote.baseURI, endpoints.quote.byId(id));
    return this.api.patch(url, body, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
    });
  }

  async deleteQuote(id: string) {
    const url = buildApiUrl(endpoints.quote.baseURI, endpoints.quote.byId(id));
    return this.api.delete(url);
  }
}