import { getLatestEntryDate, setLatestEntryDate } from './write-metadata';
import { writePoints } from './write-points';
import InfluxClient from './influx-client';

const InfluxDbClient = {
  getLatestEntryDate,
  setLatestEntryDate,
  writePoints,
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
