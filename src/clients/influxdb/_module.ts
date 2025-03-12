import { getLastRecordDate, setLastRecordDate } from './metadata';
import { writePoints } from './write-points';
import InfluxClient from './influx-client';

const InfluxDbClient = {
  getLastRecordDate,
  setLastRecordDate,
  writePoints,
  flush: async () => {
    const client = InfluxClient.getInstance();
    await client.writeApi.flush();
  },
  close: async () => {
    const client = InfluxClient.getInstance();
    await client.writeApi.close();
  },
  DANGEROUS_CLEAR_BUCKET: async () => {
    const client = InfluxClient.getInstance();
    await client.clearBucket();
  },
};

export default InfluxDbClient;
