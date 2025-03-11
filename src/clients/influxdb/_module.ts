import { getLatestEntryDate, setLatestEntryDate } from './write-metadata';
import logger from '../../logger';
import InfluxClient from './influx-client';

const InfluxDbClient = {
  getLatestEntryDate,
  setLatestEntryDate,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  writeMeasurements: async (_data: unknown) => {
    logger.warn('InfluxDbClient.writeMeasurements() is not implemented');
  },
  flush: async () => {
    const client = InfluxClient.getInstance();
    await client.writeApi.flush();
  },
  close: async () => {
    const client = InfluxClient.getInstance();
    await client.writeApi.close();
  },
};

export default InfluxDbClient;
