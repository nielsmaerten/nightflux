import { NightfluxPoint } from '../influxdb/influx-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapEntry(e: any): NightfluxPoint | null {
  const allowedTypes = ['sgv', 'mbg'];
  if (!allowedTypes.includes(e.type)) return null;
  return {
    measurement: 'glucose',
    date: new Date(e.date || e.dateString),
    tags: {
      device: e.device,
      direction: e.direction,
      type: e.type,
    },
    fields: {
      glucose: e[e.type],
      delta: e.delta || 0,
    },
    type: 'float',
    source: JSON.stringify(e),
  };
}
