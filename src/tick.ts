import config from './config';
import logger from './logger';

export default async function onTick() {
  logger.info('Tick');
  logger.debug('Current configuration', config);

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      logger.info('Tick done');
      resolve();
    }, 60000);
  },
  );
}
