import { ApiClient } from '../core/api/apiClient';
import { endpoints } from '../config/endpoints';
import { Quote, QuoteCreate, QuoteUpdate, JsonPatch } from '../models/quote.model';

export class QuoteService {
  constructor(private api: ApiClient) {}

  async listQuotes(queryParams?: { [key: string]: any }) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.list}`;
    return this.api.get(url, { params: queryParams });
  }

  async createQuote(body: QuoteCreate) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.create}`;
    return this.api.post(url, body);
  }

  async retrieveQuote(id: string, queryParams?: { [key: string]: any }) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.byId(id)}`;
    return this.api.get(url, { params: queryParams });
  }

  async patchQuote(id: string, body: QuoteUpdate | JsonPatch) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.update(id)}`;
    return this.api.patch(url, body);
  }

  async deleteQuote(id: string) {
    const url = `${endpoints.quoteManagement.baseURI}${endpoints.quoteManagement.quote.delete(id)}`;
    return this.api.delete(url);
  }
}