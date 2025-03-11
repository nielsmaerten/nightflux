import config from '../config';
import logger from '../logger';
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client';

// Extract InfluxDB configuration from the config object
const { influxDbBucket, influxDbOrg, influxDbToken, influxDbUrl } = config;

// Constants
const METADATA_MEASUREMENT = 'latest_entry';
const METADATA_FIELD = 'last_updated';

// Set up InfluxDB client and query API singleton
let influxDB: InfluxDB | null = null;
let queryApi: QueryApi | null = null;
function init() {
  logger.info('Initializing InfluxDB client');
  influxDB = new InfluxDB({ url: influxDbUrl, token: influxDbToken });
  queryApi = influxDB.getQueryApi(influxDbOrg);
  if (!influxDB || !queryApi) throw new Error('Failed to initialize InfluxDB client');
}

export async function getLatestEntryDate(): Promise<Date> {
  // Ensure the InfluxDB client is initialized
  if (!influxDB || !queryApi) init();
  if (!influxDB || !queryApi) throw new Error('Just a typescript guard: This should never happen');

  try {
    // Flux query to get the latest entry date from metadata
    const query = `
      from(bucket: "${influxDbBucket}")
        |> range(start: 0)
        |> filter(fn: (r) => r._measurement == "${METADATA_MEASUREMENT}" and r._field == "${METADATA_FIELD}")
        |> last()
    `;

    // Execute query and get the result
    const result = await queryApi.collectRows<{ _time: string; _value: number }>(query);

    // If we have a result, return the timestamp
    if (result && result.length > 0) {
      return new Date(result[0]._value);
    }

    // If no data found, return epoch
    return new Date(0);
  }
  catch (error) {
    logger.error('Failed to get latest entry date from InfluxDB', error);
    throw error;
  }
}

export async function writeEntries(entries: { date: Date }[]): Promise<void> {
  // Sort the entries by date ascending
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  // Get the date of the most recent entry
  const lastDate = entries[entries.length - 1].date;
  // Ensure the InfluxDB client is initialized
  if (!influxDB || !queryApi) init();
  if (!influxDB || !queryApi) throw new Error();
  // Write metadata
  const metadata = {
    _time: lastDate.toISOString(),
    _measurement: 'latest_entry',
    _field: 'last_updated',
  };
  try {
    // Write metadata to InfluxDB
  }
  catch (error) {
    logger.error('Failed to write metadata to InfluxDB', error);
    throw error;
  }
}
