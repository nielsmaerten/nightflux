import config from '../../config';
import logger from '../../utils/logger';
import { InfluxDB, QueryApi, WriteApi } from '@influxdata/influxdb-client';

const { influxDbOrg, influxDbToken, influxDbUrl, influxDbBucket } = config;

export default class InfluxClient {
  private static instance: InfluxClient;
  public influxDB: InfluxDB;
  public queryApi: QueryApi;
  public writeApi: WriteApi;

  private constructor() {
    logger.debug('Initializing InfluxDB client');
    this.influxDB = new InfluxDB({ url: influxDbUrl, token: influxDbToken });
    this.queryApi = this.influxDB.getQueryApi(influxDbOrg);
    this.writeApi = this.influxDB.getWriteApi(influxDbOrg, influxDbBucket);

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
