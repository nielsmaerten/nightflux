import logger from '@/logger';
import * as nightscout from '@/clients/nightscout';
import * as influxDB from '@/clients/influxdb';

// Max number of entries in a single tick
const MAX_ENTRIES = 100_000;

export default async function onTick() {
  // Get date of the latest entry in InfluxDB
  let syncedUpTo = await influxDB.getLatestEntryDate();
  let moreData = true;
  let entriesFetched = 0;

  // Loop until there is no more data to fetch
  while (moreData) {
    // Fetch 1 batch of data from Nightscout
    const data = await nightscout.fetchDataSince(syncedUpTo);
    entriesFetched += data.length;
    syncedUpTo = data[data.length - 1].date;

    // Break if less than 2 entries were fetched (prevents infinite loop)
    if (data.length <= 1) {
      moreData = false;
      break;
    }

    // Break if more than MAX_ENTRIES entries were fetched
    if (entriesFetched > MAX_ENTRIES) {
      logger.warn(`Fetched more than ${MAX_ENTRIES} entries, deferring until next tick`);
      moreData = false;
      break;
    }

    // Write fetched data to InfluxDB
    await influxDB.writeEntries(data);
  }
}
