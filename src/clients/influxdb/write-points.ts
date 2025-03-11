import { Point } from '@influxdata/influxdb-client';
import InfluxClient from './influx-client';
import logger from '../../utils/logger';
import { NightfluxPoint } from './influx-types';

export async function writePoints(data: NightfluxPoint[]) {
  const { writeApi } = InfluxClient.getInstance();

  // Write each entry as a point to InfluxDB
  for (const entry of data) {
    // Create a point for the entry
    const point = new Point(entry.measurement)
      .timestamp(entry.date);

    // Add tags to the point
    for (const [key, value] of Object.entries(entry.tags)) {
      point.tag(key, value);
    }

    // Add fields to the point
    for (const [key, value] of Object.entries(entry.fields)) {
      switch (entry.type) {
        case 'float':
          point.floatField(key, value);
          break;
        case 'int':
          point.intField(key, value);
          break;
        case 'string':
          point.stringField(key, value);
          break;
        case 'boolean':
          point.booleanField(key, value);
          break;
      }
    }

    logger.debug(`==> ${point.toLineProtocol()}`);

    writeApi.writePoint(point);
  }

  logger.info(`Wrote ${data.length} entries to InfluxDB`);
};
