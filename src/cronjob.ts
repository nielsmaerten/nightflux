import { CronJob } from 'cron';
import config from './config';
import onTick from './tick';

const timezone = config.timezone || undefined;
const startImmediately = false;
const onComplete = null;

const job = new CronJob(
  config.cronSchedule,
  onTick,
  onComplete,
  startImmediately,
  timezone,
);

export default job;
