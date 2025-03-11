import { Point } from '@influxdata/influxdb-client';
import InfluxClient from './influx-client';
import config from '../../config';
import logger from '../../utils/logger';

const METADATA_MEASUREMENT = 'metadata';
const METADATA_FIELD = 'last_updated';

const { influxDbBucket } = config;

export async function getLatestEntryDate(): Promise<Date> {
  const { queryApi } = InfluxClient.getInstance();

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

export async function setLatestEntryDate(lastDate: Date): Promise<void> {
  try {
    // Write metadata to InfluxDB
    const { writeApi } = InfluxClient.getInstance();

    // Create a point for the metadata
    const point = new Point(METADATA_MEASUREMENT)
      .timestamp(0)
      .intField(METADATA_FIELD, lastDate.getTime());

    // Write the point to InfluxDB
    writeApi.writePoint(point);

    logger.debug(`Updated metadata with latest entry date: ${lastDate.toISOString()}`);
  }
  catch (error) {
    logger.error('Failed to write metadata to InfluxDB', error);
    throw error;
  }
}
