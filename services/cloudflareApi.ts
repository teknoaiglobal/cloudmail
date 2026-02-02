
import { CloudflareCredentials, ApiResponse } from '../types';

export class CloudflareService {
  private creds: CloudflareCredentials;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(creds: CloudflareCredentials) {
    this.creds = creds;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Email': this.creds.email,
        'X-Auth-Key': this.creds.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors?.[0]?.message || 'Cloudflare API request failed');
    }

    return response.json();
  }

  // Settings
  async getSettings() {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing`);
  }

  async enableRouting() {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/enable`, { method: 'POST' });
  }

  async disableRouting() {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/disable`, { method: 'POST' });
  }

  // Addresses
  async listAddresses(page = 1) {
    return this.request<any[]>(`/accounts/${this.creds.accountId}/email/routing/addresses?page=${page}`);
  }

  async createAddress(email: string) {
    return this.request<any>(`/accounts/${this.creds.accountId}/email/routing/addresses`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async deleteAddress(id: string) {
    return this.request<any>(`/accounts/${this.creds.accountId}/email/routing/addresses/${id}`, {
      method: 'DELETE',
    });
  }

  // DNS
  async getDnsSettings() {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/dns`);
  }

  // Rules
  async listRules() {
    return this.request<any[]>(`/zones/${this.creds.zoneId}/email/routing/rules`);
  }

  async createRule(rule: Partial<any>) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async deleteRule(id: string) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/${id}`, {
      method: 'DELETE',
    });
  }

  async updateRule(id: string, rule: Partial<any>) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    });
  }

  // Catch-all
  async getCatchAll() {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/catch_all`);
  }

  async updateCatchAll(data: any) {
    return this.request<any>(`/zones/${this.creds.zoneId}/email/routing/rules/catch_all`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}
