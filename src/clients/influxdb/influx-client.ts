import config from '../../config';
import logger from '../../utils/logger';
import { InfluxDB, QueryApi, WriteApi } from '@influxdata/influxdb-client';
import { DeleteAPI } from '@influxdata/influxdb-client-apis';

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

  public async clearBucket() {
    logger.warn('*** CLEARING INFLUXDB BUCKET');
    logger.warn('*** If you don\'t know what you\'re doing, press CTRL+C now!');
    logger.warn('*** CLEARING INFLUXDB BUCKET');
    await new Promise(resolve => setTimeout(resolve, 5000));
    const deleteApi = new DeleteAPI(this.influxDB);
    await deleteApi.postDelete({
      bucket: influxDbBucket,
      org: influxDbOrg,
      body: {
        start: '1970-01-01T00:00:00Z',
        stop: '2100-01-01T00:00:00Z',
      },
    });
    logger.warn('*** INFLUXDB BUCKET CLEARED');
  }
}
