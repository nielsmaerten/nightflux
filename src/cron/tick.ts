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

  // Get date of the latest entry in InfluxDB
  let syncedUpTo = await InfluxDbClient.getLastRecordDate(recordType);
  let entriesFetched = 0;

  // Loop until a break condition is met
  while (true) {
    // Fetch a batch of data from Nightscout
    const data = await nightscout.fetchRecordsSince(recordType, syncedUpTo);
    entriesFetched += data.length;

    // Break if no data was fetched
    if (data.length === 0) break;

    // Break if no new data was fetched:
    // The last entry fetched should be the same as the last entry in InfluxDB
    const lastEntryDate = data[data.length - 1].date;
    if (lastEntryDate <= syncedUpTo) {
      logger.info(`Sync of "${recordType}" is up to date`);
      break;
    }
    // Move the cursor to the last entry fetched
    else syncedUpTo = lastEntryDate;

    // Write fetched data to InfluxDB
    await InfluxDbClient.writePoints(data);
    await InfluxDbClient.setLastRecordDate(recordType, syncedUpTo);

    // Check if we should stop early
    if (isStopping()) break;

    // Break if more than MAX_ENTRIES entries were fetched
    if (entriesFetched > MAX_ENTRIES) {
      logger.warn(`Fetched more than ${MAX_ENTRIES} entries, deferring until next tick`);
      break;
    }

    // Log progress
    const paddedTotal = String(entriesFetched).padStart(6, ' ');
    logger.info(`Fetched ${paddedTotal} ${recordType}-records, synced up to ${syncedUpTo.toISOString()}`);
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
