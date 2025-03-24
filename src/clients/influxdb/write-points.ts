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

  logger.debug(`Wrote ${data.length} records to InfluxDB`);
};

export function getInfluxDbPoint(nsPoint: NightfluxPoint) {
  // If the entry has no measurement, it should be skipped
  if (!nsPoint.measurement) return null;

  // Create a point for the entry
  const influxPoint = new Point(nsPoint.measurement)
    .timestamp(nsPoint.date);

  // Add tags to the point
  for (const [key, value] of Object.entries(nsPoint.tags)) {
    influxPoint.tag(key, value);
  }

  // Add fields to the point
  for (const [key, field] of Object.entries(nsPoint.fields)) {
    const [fieldType, fieldValue] = field;
    switch (fieldType) {
      case 'float':
        influxPoint.floatField(key, fieldValue);
        break;
      case 'int':
        influxPoint.intField(key, Math.round(fieldValue));
        break;
      case 'string':
        influxPoint.stringField(key, fieldValue);
        break;
      case 'boolean':
        influxPoint.booleanField(key, fieldValue);
        break;
    }
  }

  return influxPoint;
}
