import logger from './logger';

process.on('SIGINT', () => {
  stop();
});

process.on('SIGTERM', () => {
  stop();
});

let stopReceived = false;
export const isStopping = () => stopReceived;
let isRunning = false;
export const setIsRunning = (running: boolean) => {
  isRunning = running;
};

export const stop = () => {
  stopReceived = true;
  if (!isRunning) {
    logger.warn('Exiting...');
    process.exit(0);
  }
  else {
    logger.warn('Job is currently running.');
    logger.warn('Exiting after the current batch is done...');
  }
};
