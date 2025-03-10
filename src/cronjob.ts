import { CronJob } from 'cron';
import config from './config';
import onTick from './tick';

const job = CronJob.from(
  {
    onTick,
    cronTime: config.cronSchedule,
    timeZone: config.timezone || undefined,
    waitForCompletion: true,
  },
);

export default job;
