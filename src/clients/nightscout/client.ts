import config from '../../config';
import { mapEntry, mapTreatment } from './mappers';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { jwtDecode } from 'jwt-decode';
import logger from '../../utils/logger';
import { NightfluxPoint } from '../influxdb/influx-types';

const FETCH_LIMIT = 1000;

export default class NightscoutClient {
  private static instance: NightscoutClient | null = null;
  private readonly nightscoutClient: AxiosInstance;
  private readonly nightscoutToken: string;
  private readonly nightscoutUrl: string;
  private jwtExpiration = 0;

  private constructor() {
    logger.debug('Initializing Nightscout client');

    // Get Nightscout configuration
    const { nightscoutToken, nightscoutUrl } = config;
    this.nightscoutToken = nightscoutToken;
    this.nightscoutUrl = nightscoutUrl;

    // Initialize the Axios client
    this.nightscoutClient = axios.create({
      baseURL: nightscoutUrl,
    });

    // Check if the JWT is expired before each request
    const checkJwt = async (config: InternalAxiosRequestConfig) => {
      const now = Math.floor(Date.now() / 1000);
      if (now >= this.jwtExpiration) {
        const jwt = await this.authenticate().catch((e) => {
          const errMessage = e.message || '';
          throw new Error(`Failed to authenticate with Nightscout: ${errMessage}`);
        });
        // JWT is now set for future requests, but we also need to set it for this request
        config.headers['Authorization'] = `Bearer ${jwt}`;
      }
      return config;
    };
    this.nightscoutClient.interceptors.request.use(checkJwt);
  }

  public static getInstance(): NightscoutClient {
    if (!NightscoutClient.instance) NightscoutClient.instance = new NightscoutClient();
    return NightscoutClient.instance;
  }

  private async authenticate(): Promise<string> {
    logger.info('Refreshing Nightscout authentication token');
    const url = `${this.nightscoutUrl}/api/v2/authorization/request/${this.nightscoutToken}`;
    const response = await axios.get(url);
    const jwt: string = response.data.token;
    this.jwtExpiration = jwtDecode(jwt).exp || 0;
    // Set the JWT in the Axios client for future requests
    this.nightscoutClient.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    // Return the JWT for immediate use
    return jwt;
  }

  public async fetchRecordsSince(recordType: string, date: Date, limit = FETCH_LIMIT): Promise<NightfluxPoint[]> {
    logger.debug(`Fetching Nightscout ${recordType} since ${date.toISOString()}`);
    switch (recordType) {
      case 'treatments':
        return await this.fetchTreatmentsSince(date, limit).then(sortByDate);
      case 'entries':
        return await this.fetchEntriesSince(date, limit).then(sortByDate);
      default:
        throw new Error(`Invalid record type: ${recordType}`);
    }
  }

  private async fetchEntriesSince(date: Date, limit: number): Promise<NightfluxPoint[]> {
    // Entries use 'date' instead of 'created_at'!
    const response = await this.nightscoutClient.get('/api/v3/entries.json', {
      params: {
        limit,
        date$gte: date.getTime(),
        sort: 'date',
      },
    });

    const isValid = response.data && response.data.result && Array.isArray(response.data.result);
    if (!isValid) throw new Error('Invalid response from Nightscout', response.data);

    const result = response.data.result as unknown[];

    // Map results to a common format
    const points = result.map(mapEntry).flat();

    // If any of the points have the exact same date, log a warning
    const dates = points.map(p => p.date.toISOString());
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      const msg = 'Duplicate dates found in Nightscout entries';
      logger.error(msg, { dates });
    }
    return points;
  }

  private async fetchTreatmentsSince(date: Date, limit: number): Promise<NightfluxPoint[]> {
    // Treatments use 'created_at' instead of 'date'!
    const response = await this.nightscoutClient.get('/api/v3/treatments.json', {
      params: {
        limit,
        created_at$gte: date.toISOString(),
        sort: 'created_at',
      },
    });

    const isValid = response.data && response.data.result && Array.isArray(response.data.result);
    if (!isValid) throw new Error('Invalid response from Nightscout', response.data);

    const result = response.data.result as unknown[];
    logger.debug(`Fetched ${result.length} treatments from Nightscout`);

    // Map results to a common format
    return result.map(mapTreatment).flat();
  }
}

function sortByDate(records: NightfluxPoint[]) {
  return records.sort((a, b) => a.date.getTime() - b.date.getTime());
}
