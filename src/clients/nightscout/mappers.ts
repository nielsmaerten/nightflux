import { NightfluxPoint } from '../influxdb/influx-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapEntry(e: any): NightfluxPoint[] {
  const allowedTypes = ['sgv', 'mbg'];
  if (!allowedTypes.includes(e.type)) return [];
  return [{
    _id: e.identifier,
    measurement: 'glucose',
    date: new Date(e.date || e.dateString),
    tags: {},
    fields: {
      glucose: ['float', e.sgv || e.mbg],
      direction: ['string', e.direction],
    },
    source: JSON.stringify(e),
  }];
}

// const treatmentTypes = ['Temp Basal', 'Temporary Target', 'Bolus Wizard', 'Carb Correction', 'Profile Switch', 'Correction Bolus', 'OpenAPS Offline', ''];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTreatment(e: any): NightfluxPoint[] {
  const points: NightfluxPoint[] = [];

  if (e.insulin) {
    const isSMB = e.type === 'SMB' || e.isSMB === true;
    points.push({
      _id: e.identifier,
      measurement: 'insulin',
      date: new Date(e.created_at),
      tags: {},
      fields: {
        insulin: ['float', e.insulin],
        isSMB: ['boolean', isSMB],
        type: ['string', e.type || 'N/A'],
        eventType: ['string', e.eventType || 'N/A'],
      },
      source: JSON.stringify(e),
    });
  }

  if (e.carbs) points.push({
    _id: e.identifier,
    measurement: 'carbs',
    date: new Date(e.created_at),
    tags: {},
    fields: {
      carbs: ['int', e.carbs],
      eventType: ['string', e.eventType || 'N/A'],
      type: ['string', e.type || 'N/A'],
    },
    source: JSON.stringify(e),
  });

  if (parseFloat(e.rate)) points.push({
    _id: e.identifier,
    measurement: 'basal',
    date: new Date(e.created_at),
    tags: {},
    fields: {
      rate: ['float', e.rate || 0],
      eventType: ['string', e.eventType || 'N/A'],
      type: ['string', e.type || 'N/A'],
    },
    source: JSON.stringify(e),
  });

  // If no points were added, add a dummy point
  // This won't be written to InfluxDB, but it will
  // update the timestamp of the cursor so we can move on
  if (points.length === 0) {
    points.push({
      _id: e.identifier,
      measurement: '', // Empty measurement to avoid writing to InfluxDB
      date: new Date(e.created_at),
      tags: {},
      fields: {
        eventType: ['string', e.eventType || 'N/A'],
        type: ['string', e.type || 'N/A'],
      },
      source: JSON.stringify(e),
    });
  }
  return points;
}
