import logger from './logger';

process.on('SIGINT', () => {
  logger.info('Received SIGINT, wrapping up...');
  stop();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, wrapping up...');
  stop();
});

let stopReceived = false;
export const isStopping = () => stopReceived;

export const stop = () => {
  stopReceived = true;
};
