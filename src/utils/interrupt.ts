import logger from './logger';

const msg = 'Received SIGINT: Writing final data points and exiting...';

process.on('SIGINT', () => {
  logger.warn(msg);
  stop();
});

process.on('SIGTERM', () => {
  logger.warn(msg);
  stop();
});

let stopReceived = false;
export const isStopping = () => stopReceived;

export const stop = () => {
  stopReceived = true;
};
