import logger from './logger';

const msg = 'Received SIGINT: Writing final data points and exiting...';

process.on('SIGINT', () => {
  logger.info(msg);
  stop();
});

process.on('SIGTERM', () => {
  logger.info(msg);
  stop();
});

let stopReceived = false;
export const isStopping = () => stopReceived;

export const stop = () => {
  stopReceived = true;
};
