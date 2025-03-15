import logger from '../utils/logger';
import { isStopping, setIsRunning } from '../utils/interrupt';
import NightscoutClient from '../clients/nightscout/client';
import InfluxDbClient from '../clients/influxdb/_module';
import config from '../config';

const MAX_ENTRIES = config.limit || 10_000;
const nightscout = NightscoutClient.getInstance();

export default async function onTick(): Promise<void> {
  setIsRunning(true);
  const collections = ['treatments', 'entries'];
  for (const collection of collections) {
    await syncCollecction(collection);
  }
  setIsRunning(false);
}

export async function syncCollecction(recordType: string): Promise<void> {
  // If the --dangerous-clear-db flag is passed, clear the InfluxDB bucket and exit
  if (process.argv.includes('--dangerous-clear-db')) {
    await InfluxDbClient.DANGEROUS_CLEAR_BUCKET();
    process.exit(0);
  }

  // Initialize the record cursor
  const recordCursor = {
    _id: '',
    date: await InfluxDbClient.getLastRecordDate(recordType),
  };
  let entriesFetched = 0;

  // Loop until a break condition is met
  while (true) {
    // Fetch records >= recordCursor.date
    const unfiltered = await nightscout.fetchRecordsSince(recordType, recordCursor.date);
    entriesFetched += unfiltered.length;

    // Discard records that were already fetched
    const filtered = unfiltered.filter((entry) => {
      if (entry.date < recordCursor.date) return false;
      if (recordCursor._id) {
        if (entry._id < recordCursor._id) return false;
      }
      return true;
    });

    // Break if no data was fetched
    if (filtered.length === 0) break;

    // Update the cursor
    recordCursor.date = filtered[filtered.length - 1].date;
    recordCursor._id = filtered[filtered.length - 1]._id;

    // Write fetched data to InfluxDB
    await InfluxDbClient.writePoints(filtered);
    await InfluxDbClient.setLastRecordDate(recordType, recordCursor.date);

    // Check if we should stop early
    if (isStopping()) break;

    // Break if more than MAX_ENTRIES entries were fetched
    if (entriesFetched > MAX_ENTRIES) {
      logger.warn(`Fetched more than ${MAX_ENTRIES} entries, deferring until next tick`);
      break;
    }

    // Log progress
    const paddedTotal = String(entriesFetched).padStart(6, ' ');
    logger.info(`Fetched ${paddedTotal} ${recordType}-records, synced up to ${recordCursor.date.toISOString()}`);
  }

  // The loop is done, flush the write API
  await InfluxDbClient.flush();

  // If we received a stop signal, close the InfluxDB client and exit
  if (isStopping()) {
    await InfluxDbClient.close();
    process.exit(0);
  }

  // Up next is publishing on the registry
  // Letting it pull my own data
  // And of course getting boluses, carbs, etc
}
