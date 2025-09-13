import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ProxyAgent } from 'proxy-agent';

/**
 * Nightscout API client
 * - Initializes an Axios instance using a base URL from env or constructor
 * - Ensures the Nightscout `token` query param is included on every request
 */
export default class Nightscout {
  #client: AxiosInstance;
  #token?: string;

  constructor(baseUrl?: string) {
    const resolvedBaseUrl = baseUrl || process.env.NIGHTSCOUT_URL;

    if (!resolvedBaseUrl) {
      throw new Error(
        'Nightscout base URL not provided. Set NIGHTSCOUT_URL (or NS_URL / NIGHTSCOUT_BASE_URL).',
      );
    }

    // Extract token from the provided base URL if present and remove it from the base URL itself
    const url = new URL(resolvedBaseUrl);
    const token = url.searchParams.get('token') || undefined;
    if (token) {
      url.searchParams.delete('token');
      this.#token = token;
    }

    const agent = new ProxyAgent();

    this.#client = axios.create({
      baseURL: url.toString(),
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
    });

    // Add token on every outgoing request unless already present on that request
    this.#client.interceptors.request.use((config) => {
      if (!this.#token) return config;

      // If request URL already has token, don't duplicate
      const urlHasToken = (() => {
        try {
          if (!config.url) return false;
          const full = new URL(
            config.url,
            // Fallback origin required for relative URLs
            this.#client.defaults.baseURL || 'http://localhost',
          );
          return full.searchParams.has('token');
        } catch {
          return false;
        }
      })();

      // If params already include token, skip
      const paramsHasToken =
        typeof config.params === 'object' && config.params !== null
          ? Object.prototype.hasOwnProperty.call(config.params as object, 'token')
          : false;

      if (!urlHasToken && !paramsHasToken) {
        if (!config.params || typeof config.params !== 'object') {
          config.params = { token: this.#token };
        } else if (!(config.params as any).token) {
          (config.params as any).token = this.#token;
        }
      }

      return config;
    });
  }

  /**
   * Expose the underlying Axios instance for advanced usage if needed.
   */
  get axios(): AxiosInstance {
    return this.#client;
  }

  /**
   * Perform a GET request relative to the Nightscout base URL.
   */
  async query<T = unknown>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await this.#client.get<T>(path, config);
    return res.data;
  }
}

/**
 * Convenience base for Nightscout-backed clients.
 */
export class NightscoutClientBase {
  constructor(protected ns: Nightscout) {}
}
