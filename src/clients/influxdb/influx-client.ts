import config from '../../config';
import logger from '../../logger';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

const { influxDbOrg, influxDbToken, influxDbUrl } = config;

export default class InfluxClient {
  private static instance: InfluxClient;
  public influxDB: InfluxDB;
  public queryApi: QueryApi;

  private constructor() {
    logger.info('Initializing InfluxDB client');
    this.influxDB = new InfluxDB({ url: influxDbUrl, token: influxDbToken });
    this.queryApi = this.influxDB.getQueryApi(influxDbOrg);

    if (!this.influxDB || !this.queryApi) {
      throw new Error('Failed to initialize InfluxDB client');
    }
  }

  // Returns the singleton instance
  public static getInstance(): InfluxClient {
    if (!InfluxClient.instance) InfluxClient.instance = new InfluxClient();
    return InfluxClient.instance;
  }
}
