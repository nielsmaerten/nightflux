import { NightfluxPoint } from '../influxdb/influx-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapEntry(e: any): NightfluxPoint[] {
  const allowedTypes = ['sgv', 'mbg'];
  if (!allowedTypes.includes(e.type)) return [];
  return [{
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
  }];
}

// const treatmentTypes = ['Temp Basal', 'Temporary Target', 'Bolus Wizard', 'Carb Correction', 'Profile Switch', 'Correction Bolus', 'OpenAPS Offline', ''];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTreatment(e: any): NightfluxPoint[] {
  const points: NightfluxPoint[] = [];
  const insulin = e.insulin || 0;
  if (insulin) points.push({
    measurement: 'insulin',
    date: new Date(e.created_at),
    tags: {
      eventType: e.eventType || 'N/A',
      type: e.type || 'N/A',
      isSMB: e.isSMB ? 'true' : 'false',
    },
    fields: {
      insulin,
    },
    type: 'float',
    source: JSON.stringify(e),
  });
  return points;
}
