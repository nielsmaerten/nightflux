import logger from '../utils/logger';
import { isStopping, setIsRunning } from '../utils/interrupt';
import NightscoutClient from '../clients/nightscout/client';
import InfluxDbClient from '../clients/influxdb/_module';
import config from '../config';

const JOB_LIMIT = config.limit || 20_000;
const FETCH_LIMIT = 1000;
const nightscout = NightscoutClient.getInstance();

export default async function onTick(): Promise<void> {
  setIsRunning(true);
  const collections = getCollections();
  for (const collection of collections) {
    await syncCollecction(collection);
  }
  logger.info('Job completed');
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
  let totalRecordsFetched = 0;

  // Loop until a break condition is met
  while (true) {
    // Check if we should stop early
    if (isStopping()) break;

    // Fetch records >= recordCursor.date
    const incomingRecords = await nightscout.fetchRecordsSince(recordType, recordCursor.date, FETCH_LIMIT);
    totalRecordsFetched += incomingRecords.length;

    // If no records were fetched, we're done
    if (incomingRecords.length === 0) break;

    // Get the latest record fetched
    const latestRecord = incomingRecords[incomingRecords.length - 1];
    const oldestRecord = incomingRecords[0];

    // Verify new records were fetched by comparing the latest record's date to the cursor
    const newRecordsFound = oldestRecord.date.getTime() !== latestRecord.date.getTime();

    if (newRecordsFound) {
      // If the cursor has advanced, set it to the latest record fetched: all good.
      recordCursor._id = latestRecord._id;
      recordCursor.date = latestRecord.date;
    }
    else {
      // This ordinarily shouldn't happen, but if it does, move the cursor forward by 1s
      // It means that over the entire fetch, all records had the same timestamp?
      logger.warn(`No new records? Moving cursor forward by 1s: ${recordCursor.date.toISOString()}`);
      if (incomingRecords.length >= FETCH_LIMIT / 2) {
        // If we get here, the database almost certainly has an issue with duplicate records
        // We can work around this, but should warn the user
        logger.warn(`Warning: ${FETCH_LIMIT / 2} or more records share the same timestamp.`);
        logger.warn(`This is likely due to duplicate records in the Nightscout database.`);
        logger.warn(`Nightflux can continue, but you should investigate this.`);
        logger.warn(`Timestamp: ${recordCursor.date.toISOString()}`);
      }
      recordCursor._id = '';
      recordCursor.date = new Date(latestRecord.date.getTime() + 1000);
    }

    // Write fetched data to InfluxDB
    await InfluxDbClient.writePoints(incomingRecords);
    await InfluxDbClient.setLastRecordDate(recordType, recordCursor.date);

    // Break if more than MAX_ENTRIES entries were fetched
    if (totalRecordsFetched > JOB_LIMIT) {
      logger.warn(`Fetched more than ${JOB_LIMIT} entries, deferring until next tick`);
      break;
    }

    // Log progress
    const paddedTotal = String(totalRecordsFetched).padStart(6, ' ');
    logger.info(`Fetched ${paddedTotal} ${recordType}-records, synced up to ${recordCursor.date.toISOString()}`);
  }

  // The loop is done, flush the write API
  await InfluxDbClient.flush();

  // If we received a stop signal, close the InfluxDB client and exit
  if (isStopping()) {
    await InfluxDbClient.close();
    process.exit(0);
  }
}

function getCollections(): string[] {
  const only = process.argv.includes('--only');
  if (!only) {
    return ['treatments', 'entries'];
  }
  else {
    const toSync = process.argv[process.argv.indexOf('--only') + 1];
    return [toSync];
  }
}
