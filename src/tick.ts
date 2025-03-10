import config from './config';
import logger from './logger';

export default function onTick() {
  logger.info('Tick');
  logger.debug('Configuration:', config);
}
