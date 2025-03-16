import { Point } from '@influxdata/influxdb-client';
import InfluxClient from './influx-client';
import logger from '../../utils/logger';
import { NightfluxPoint } from './influx-types';

export async function writePoints(data: NightfluxPoint[]) {
  const { writeApi } = InfluxClient.getInstance();

  // Write each entry as a point to InfluxDB
  for (const entry of data) {
    try {
      const point = getInfluxDbPoint(entry);
      if (!point) continue;
      logger.debug(`==> ${point.toLineProtocol()}`);
      writeApi.writePoint(point);
    }
    catch (error) {
      const msg = (error as Error).message || 'Unknown error';
      logger.error(`Failed to write point to InfluxDB`, { error: msg, entry });
    }
  }

  logger.debug(`Wrote ${data.length} entries to InfluxDB`);
};

export function getInfluxDbPoint(entry: NightfluxPoint) {
  // If the entry has no measurement, it should be skipped
  if (!entry.measurement) return null;

  // Create a point for the entry
  const point = new Point(entry.measurement)
    .timestamp(entry.date);

  // Add tags to the point
  for (const [key, value] of Object.entries(entry.tags)) {
    point.tag(key, value);
  }

  // Add fields to the point
  for (const [key, field] of Object.entries(entry.fields)) {
    const [fieldType, fieldValue] = field;
    switch (fieldType) {
      case 'float':
        point.floatField(key, fieldValue);
        break;
      case 'int':
        point.intField(key, fieldValue);
        break;
      case 'string':
        point.stringField(key, fieldValue);
        break;
      case 'boolean':
        point.booleanField(key, fieldValue);
        break;
    }
  }

  return point;
}
